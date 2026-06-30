"use server"

import { randomUUID } from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { notificationSubscriptions } from "@/database/collections"
import { db } from "@/database/db"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireWorkspace } from "@/lib/rbac/guards"

/**
 * Web Push subscription server actions (see BUILD/05 §push). Subscriptions live
 * in the USER-GLOBAL `notificationSubscriptions` collection — keyed by userId,
 * NOT workspace-scoped — so a user's browser endpoints span all their
 * workspaces. We therefore go through the raw `db` client (the Repository is
 * workspace-scoped and cannot reach this table), mirroring the storage shape and
 * `data ->> 'userId'` query style that `dispatch.ts`'s loadSubscriptions /
 * pruneSubscriptions read back.
 *
 * Every action is auth-gated via `requireWorkspace` (resolves the user id) and
 * returns the uniform `ActionResult` envelope — it never throws across the
 * server/client boundary.
 */

/** Shape stored in `notificationSubscriptions.data` — read back by dispatch.ts. */
interface StoredSubscription {
    userId: string
    endpoint: string
    keys: { p256dh: string; auth: string }
    userAgent?: string
}

/** The browser PushSubscription payload the client serialises to JSON. */
interface SubscriptionInput {
    endpoint?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
    userAgent?: unknown
}

function parseSubscription(
    input: SubscriptionInput,
    userId: string
): StoredSubscription | null {
    const endpoint = typeof input.endpoint === "string" ? input.endpoint : ""
    const p256dh =
        typeof input.keys?.p256dh === "string" ? input.keys.p256dh : ""
    const auth = typeof input.keys?.auth === "string" ? input.keys.auth : ""
    if (!endpoint || !p256dh || !auth) return null
    const userAgent =
        typeof input.userAgent === "string" ? input.userAgent : undefined
    return {
        userId,
        endpoint,
        keys: { p256dh, auth },
        ...(userAgent ? { userAgent } : {})
    }
}

/** SQL predicate matching a row for `(userId, endpoint)` — mirrors dispatch.ts. */
function matchEndpoint(userId: string, endpoint: string) {
    return and(
        eq(sql`${notificationSubscriptions.data} ->> 'userId'`, userId),
        eq(sql`${notificationSubscriptions.data} ->> 'endpoint'`, endpoint)
    )
}

/**
 * Persist (or refresh) a Web Push subscription for the current user. Upserts on
 * `(userId, endpoint)` so re-subscribing the same browser doesn't duplicate
 * rows. Auth-gated; returns the stored endpoint on success.
 */
export async function saveSubscription(
    input: SubscriptionInput
): Promise<ActionResult<{ endpoint: string }>> {
    try {
        const ctx = await requireWorkspace()
        const record = parseSubscription(input, ctx.userId)
        if (!record) {
            return { status: false, message: "Invalid push subscription." }
        }

        const existing = (await db
            .select({ id: notificationSubscriptions.id })
            .from(notificationSubscriptions)
            .where(matchEndpoint(ctx.userId, record.endpoint))
            .limit(1)) as { id: string }[]

        if (existing.length > 0) {
            await db
                .update(notificationSubscriptions)
                .set({ data: record, updatedAt: new Date() })
                .where(matchEndpoint(ctx.userId, record.endpoint))
        } else {
            await db.insert(notificationSubscriptions).values({
                id: `ns-${randomUUID()}`,
                userId: ctx.userId,
                data: record
            })
        }

        return ok({ endpoint: record.endpoint })
    } catch (error) {
        return failFrom(error)
    }
}

/** Remove the current user's subscription for a given endpoint. Auth-gated. */
export async function removeSubscription(
    endpoint: unknown
): Promise<ActionResult<{ endpoint: string }>> {
    try {
        const ctx = await requireWorkspace()
        if (typeof endpoint !== "string" || endpoint.length === 0) {
            return { status: false, message: "Missing endpoint." }
        }
        await db
            .delete(notificationSubscriptions)
            .where(matchEndpoint(ctx.userId, endpoint))
        return ok({ endpoint })
    } catch (error) {
        return failFrom(error)
    }
}
