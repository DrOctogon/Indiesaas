import { eq } from "drizzle-orm"
import type { CollectionName } from "@/database/collections"
import { db } from "@/database/db"
import { members, users } from "@/database/schema"
import type { Visit } from "@/lib/domains/care/types"
import { findUpcomingVisits } from "@/lib/engine/scheduling"
import { sendEmail } from "@/lib/notify/channels/email"
import { Repository } from "@/lib/repository"

/**
 * Visit-reminder sweep (see BUILD/05 §scheduling reminders). A scheduled invoker
 * (the `/api/cron/visit-reminders` route) drives this once a day; for every
 * workspace it finds visits starting within the look-ahead window and emails the
 * care team a heads-up.
 *
 * Visits carry no assignee — only a `recipientId` (the care recipient) — so the
 * audience is every workspace member with an email, mirroring the daily-digest
 * sweep. Each (visit, member) pair is reminded AT MOST ONCE: a ledger row is
 * written to the write-only `notificationDeliveries` collection keyed
 * `${visitId}:${userId}`, and any pair already present is skipped. That makes
 * the sweep safe to run on an overlapping window without re-spamming.
 *
 * Like the digest, this NEVER throws — `sendEmail` is itself a no-op when email
 * is unconfigured, and one bad row is logged and skipped rather than aborting
 * the run. `now` is injected so the look-ahead window is deterministic.
 */

const VISITS: CollectionName = "visits"
const DELIVERIES: CollectionName = "notificationDeliveries"

/** Default look-ahead: remind for visits starting within the next 24 hours. */
const DEFAULT_WITHIN_MINUTES = 24 * 60

/** A visit-reminder ledger row, distinguished from alert deliveries by `kind`. */
interface ReminderLedgerRow {
    kind?: string
    visitId?: string
    recipientUserId?: string
}

export interface VisitReminderResult {
    /** Distinct workspaces swept. */
    workspaces: number
    /** Upcoming visits found across all workspaces. */
    upcoming: number
    /** Reminder emails actually dispatched (new (visit, member) pairs). */
    sent: number
}

/** A workspace and its members-with-email, grouped from the membership join. */
interface WorkspaceMembers {
    workspaceId: string
    members: { userId: string; email: string }[]
}

/** Group the membership⋈users rows by workspace, dropping members with no email. */
function groupByWorkspace(
    rows: readonly {
        workspaceId: string
        userId: string
        email: string | null
    }[]
): WorkspaceMembers[] {
    const byWorkspace = new Map<string, WorkspaceMembers>()
    for (const row of rows) {
        if (!row.email) continue
        const existing = byWorkspace.get(row.workspaceId)
        const member = { userId: row.userId, email: row.email }
        if (existing) {
            existing.members.push(member)
        } else {
            byWorkspace.set(row.workspaceId, {
                workspaceId: row.workspaceId,
                members: [member]
            })
        }
    }
    return [...byWorkspace.values()]
}

function formatVisitBody(visit: Visit): string {
    const lines = [
        "HomeCare · upcoming visit",
        "",
        visit.title,
        `Type: ${visit.type}`,
        `Starts: ${visit.start}`
    ]
    if (visit.location) lines.push(`Location: ${visit.location}`)
    return lines.join("\n")
}

/**
 * Sweep every workspace and email its care team about visits starting within
 * `withinMinutes` from `now`, deduped per (visit, member) via the ledger. The
 * Repository is workspace-scoped; the sweep uses the first member with an email
 * as the audit actor for each workspace's reads/writes. NEVER throws.
 */
export async function runVisitReminders(
    now: Date,
    withinMinutes: number = DEFAULT_WITHIN_MINUTES
): Promise<VisitReminderResult> {
    const rows = await db
        .select({
            workspaceId: members.organizationId,
            userId: members.userId,
            email: users.email
        })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))

    const workspaces = groupByWorkspace(rows)

    let upcomingTotal = 0
    let sent = 0

    for (const workspace of workspaces) {
        const actorId = workspace.members[0]?.userId
        if (!actorId) continue

        try {
            const repo = new Repository(actorId, workspace.workspaceId)

            const visits = await repo.list<Visit>(VISITS)
            const upcoming = findUpcomingVisits(visits, now, withinMinutes)
            upcomingTotal += upcoming.length
            if (upcoming.length === 0) continue

            const ledger = await repo.list<ReminderLedgerRow>(DELIVERIES)
            const reminded = new Set(
                ledger
                    .filter((r) => r.kind === "visit-reminder")
                    .map((r) => `${r.visitId}:${r.recipientUserId}`)
            )

            for (const visit of upcoming) {
                for (const member of workspace.members) {
                    const key = `${visit.id}:${member.userId}`
                    if (reminded.has(key)) continue
                    reminded.add(key)

                    const delivered = await sendEmail(
                        member.email,
                        "HomeCare · upcoming visit",
                        formatVisitBody(visit)
                    )

                    await repo.create(DELIVERIES, {
                        kind: "visit-reminder",
                        visitId: visit.id,
                        recipientUserId: member.userId,
                        channel: "email",
                        status: delivered > 0 ? "sent" : "skipped",
                        remindedAt: now.toISOString()
                    })

                    if (delivered > 0) sent++
                }
            }
        } catch (error) {
            console.error(
                "[notify/reminders] workspace sweep failed",
                workspace.workspaceId,
                error
            )
        }
    }

    return { workspaces: workspaces.length, upcoming: upcomingTotal, sent }
}
