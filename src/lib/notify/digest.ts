import { eq, sql } from "drizzle-orm"
import { accountPreferences } from "@/database/collections"
import { db } from "@/database/db"
import { members, users } from "@/database/schema"
import type { Alert } from "@/lib/domains/ops/types"
import { findOverdueTasks } from "@/lib/engine/tasks"
import { sendEmail } from "@/lib/notify/channels/email"
import { Repository } from "@/lib/repository"
import { getWorkspaceTimezone } from "@/lib/workspace/timezone"

/**
 * Daily digest (see BUILD/05 §digest, checklist line 143). Assembles a user's
 * day of HomeCare signal — overdue care tasks + open alerts for ONE workspace —
 * into a single plain-text summary, then (opt-in) emails it. The opt-in flag
 * lives on the USER-GLOBAL `accountPreferences` collection (keyed by userId, no
 * workspace_id), read via the raw `db` client mirroring dispatch.ts's
 * `data ->> 'userId'` style — the Repository is workspace-scoped and can't reach
 * user-global tables.
 *
 * `buildDigest` is pure-ish: `now` is injected so overdue math is deterministic
 * and workspace-local. `sendDailyDigest` NEVER throws — a mail/digest failure
 * must not break whatever scheduled it; `sendEmail` is itself a no-op when email
 * is unconfigured.
 */

/** A care task as stored — only the fields the digest reads. */
interface DigestTask {
    id: string
    label: string
    date?: string
    time?: string
    doneAt?: string | null
}

/** The plain-text digest body plus the counts that produced it. */
export interface Digest {
    body: string
    overdueCount: number
    openAlertCount: number
}

/** Shape of `accountPreferences.data` we care about — the digest opt-in flag. */
interface AccountPreferenceData {
    userId: string
    dailyDigest?: boolean
}

const CARE_TASKS = "careTasks" as const
const ALERTS = "alerts" as const

function formatTask(task: DigestTask): string {
    const due = task.date
        ? ` (due ${task.date}${task.time ? ` ${task.time}` : ""})`
        : ""
    return `  - ${task.label}${due}`
}

function formatAlert(alert: Alert): string {
    return `  - [${alert.level}] ${alert.description}`
}

/**
 * Build the plain-text daily digest for `(workspaceId, userId)` evaluated at
 * `now` in `tz` (workspace-local). Reads workspace data through the
 * workspace-scoped Repository (constructed from the userId + workspaceId), then
 * derives overdue tasks via the pure engine and open alerts by status.
 */
export async function buildDigest(
    workspaceId: string,
    userId: string,
    tz: string,
    now: Date
): Promise<Digest> {
    const repo = new Repository(userId, workspaceId)

    const [tasks, alerts] = await Promise.all([
        repo.list<DigestTask>(CARE_TASKS),
        repo.list<Alert>(ALERTS)
    ])

    const overdue = findOverdueTasks(tasks, now, tz)
    const openAlerts = alerts.filter((a) => (a.status ?? "open") === "open")

    const lines: string[] = ["HomeCare daily digest", ""]

    lines.push(`Overdue care tasks (${overdue.length}):`)
    if (overdue.length === 0) {
        lines.push("  - None")
    } else {
        for (const task of overdue) {
            lines.push(formatTask(task))
        }
    }

    lines.push("")
    lines.push(`Open alerts (${openAlerts.length}):`)
    if (openAlerts.length === 0) {
        lines.push("  - None")
    } else {
        for (const alert of openAlerts) {
            lines.push(formatAlert(alert))
        }
    }

    return {
        body: lines.join("\n"),
        overdueCount: overdue.length,
        openAlertCount: openAlerts.length
    }
}

/** Whether the user has opted in to the daily digest (user-global preference). */
async function digestOptedIn(userId: string): Promise<boolean> {
    const rows = (await db
        .select({ data: accountPreferences.data })
        .from(accountPreferences)
        .where(eq(sql`${accountPreferences.data} ->> 'userId'`, userId))
        .limit(1)) as { data: AccountPreferenceData }[]
    return Boolean(rows[0]?.data?.dailyDigest)
}

/**
 * Build and email a user's daily digest for one workspace, gated on the
 * `accountPreferences.dailyDigest` opt-in. No-op (returns false) when the user
 * hasn't opted in or there is nothing to report. NEVER throws — `sendEmail`
 * already swallows mail failures, and any other error is logged and swallowed.
 * Returns true only when a digest email was actually dispatched.
 */
export async function sendDailyDigest(
    workspaceId: string,
    userId: string,
    email: string,
    tz: string,
    now: Date
): Promise<boolean> {
    try {
        if (!(await digestOptedIn(userId))) return false

        const digest = await buildDigest(workspaceId, userId, tz, now)
        if (digest.overdueCount === 0 && digest.openAlertCount === 0) {
            return false
        }

        const sent = await sendEmail(
            email,
            "HomeCare · daily digest",
            digest.body
        )
        return sent > 0
    } catch (error) {
        console.error("[notify/digest] sendDailyDigest failed", error)
        return false
    }
}

export interface DigestRunResult {
    /** Distinct (workspace, member) pairs considered. */
    candidates: number
    /** How many actually dispatched a digest email (opted-in + had signal). */
    sent: number
}

/**
 * Sweep every (workspace, member) pair and dispatch each member's opt-in daily
 * digest for that workspace. Intended to be driven by a scheduled invoker (the
 * `/api/cron/daily-digest` route). `sendDailyDigest` gates on the per-user
 * opt-in and never throws, so one bad row can't abort the sweep. `now` is
 * injected for deterministic overdue math.
 */
export async function runDailyDigests(now: Date): Promise<DigestRunResult> {
    const rows = await db
        .select({
            workspaceId: members.organizationId,
            userId: members.userId,
            email: users.email
        })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))

    // Resolve each workspace's timezone once, not per member.
    const tzByWorkspace = new Map<string, string>()

    let sent = 0
    for (const row of rows) {
        if (!row.email) continue
        let tz = tzByWorkspace.get(row.workspaceId)
        if (tz === undefined) {
            tz = await getWorkspaceTimezone(row.workspaceId)
            tzByWorkspace.set(row.workspaceId, tz)
        }
        const dispatched = await sendDailyDigest(
            row.workspaceId,
            row.userId,
            row.email,
            tz,
            now
        )
        if (dispatched) sent++
    }
    return { candidates: rows.length, sent }
}
