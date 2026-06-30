"use server"

import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { accountPreferences } from "@/database/collections"
import { db } from "@/database/db"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireWorkspace } from "@/lib/rbac/guards"

/**
 * Daily-digest opt-in server actions for the account UI. The flag lives on the
 * USER-GLOBAL `accountPreferences` collection (keyed by userId, no
 * workspace_id), so we go through the raw `db` client — the Repository is
 * workspace-scoped and can't reach this table — mirroring dispatch.ts's
 * `data ->> 'userId'` query style. Both actions are auth-gated via
 * `requireWorkspace` (resolves the user id) and return the uniform
 * `ActionResult` envelope.
 */

/** Shape stored in `accountPreferences.data`. */
interface AccountPreferenceData extends Record<string, unknown> {
    userId: string
    dailyDigest?: boolean
}

function userMatch(userId: string) {
    return eq(sql`${accountPreferences.data} ->> 'userId'`, userId)
}

async function readPrefs(
    userId: string
): Promise<AccountPreferenceData | null> {
    const rows = (await db
        .select({ data: accountPreferences.data })
        .from(accountPreferences)
        .where(userMatch(userId))
        .limit(1)) as { data: AccountPreferenceData }[]
    return rows[0]?.data ?? null
}

/** Read the current user's daily-digest opt-in (defaults to false). */
export async function getDigestPreference(): Promise<ActionResult<boolean>> {
    try {
        const ctx = await requireWorkspace()
        const prefs = await readPrefs(ctx.userId)
        return ok(Boolean(prefs?.dailyDigest))
    } catch (error) {
        return failFrom(error)
    }
}

/** Set the current user's daily-digest opt-in flag (upsert, user-global). */
export async function setDigestPreference(
    enabled: unknown
): Promise<ActionResult<boolean>> {
    try {
        const ctx = await requireWorkspace()
        const dailyDigest = Boolean(enabled)
        const existing = await readPrefs(ctx.userId)

        if (existing) {
            const next: AccountPreferenceData = {
                ...existing,
                userId: ctx.userId,
                dailyDigest
            }
            await db
                .update(accountPreferences)
                .set({ data: next, updatedAt: new Date() })
                .where(userMatch(ctx.userId))
        } else {
            await db.insert(accountPreferences).values({
                id: `ap-${randomUUID()}`,
                userId: ctx.userId,
                data: { userId: ctx.userId, dailyDigest }
            })
        }

        return ok(dailyDigest)
    } catch (error) {
        return failFrom(error)
    }
}
