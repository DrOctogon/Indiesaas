import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/database/db"
import { invitations, members, subscriptions } from "@/database/schema"
import { type Plan, plans } from "@/lib/payments/plans"
import { seatsInUse } from "@/lib/workspace/membership"

/**
 * Seat-usage reads for the admin billing surface (System area, admin-only).
 *
 * The seat *cap* derives from the workspace's active Stripe plan (see
 * `getWorkspaceSeatCap` in `@/lib/workspace/lifecycle`, which is the gate at
 * invite time). Here we surface the same numbers read-only: how many seats are
 * consumed (active members + pending invitations) versus the plan cap. A `null`
 * cap means unlimited (billing unconfigured / no enforced cap).
 *
 * Subscriptions are per-workspace: the Stripe plugin stores the workspace id in
 * `subscriptions.reference_id` and the plan *name* in `subscriptions.plan`.
 */

/** Subscription statuses that grant the plan's seat allowance. */
const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const

/** Map a plan name (as stored on the subscription) to its configured seat cap. */
export function planSeatCap(planName: string): number | null {
    const plan: Plan | undefined = plans.find(
        (p) => p.name.toLowerCase() === planName.toLowerCase()
    )
    const seats = plan?.limits?.seats
    return typeof seats === "number" ? seats : null
}

/**
 * The active (or trialing) plan name for a workspace, or `null` when there is no
 * active subscription (billing unconfigured / free plan). Reads the
 * `subscriptions` table directly, scoped to the workspace via `reference_id`.
 */
export async function getActiveWorkspacePlanName(
    workspaceId: string
): Promise<string | null> {
    const rows = await db
        .select({ plan: subscriptions.plan, status: subscriptions.status })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.referenceId, workspaceId),
                inArray(subscriptions.status, [...ACTIVE_SUBSCRIPTION_STATUSES])
            )
        )
    return rows[0]?.plan ?? null
}

export interface SeatUsage {
    /** Active members + pending invitations. */
    used: number
    /** Plan seat cap, or `null` when unlimited (billing unconfigured / free). */
    cap: number | null
}

/**
 * Seats-in-use vs. cap for a workspace, for the admin billing UI. Counts active
 * members and pending invitations (the same definition the invite-time guard
 * enforces). `cap` is `null` when there is no active subscription/plan.
 */
export async function getWorkspaceSeatUsage(
    workspaceId: string
): Promise<SeatUsage> {
    const [memberRows, pendingInviteRows, planName] = await Promise.all([
        db
            .select({ id: members.id })
            .from(members)
            .where(eq(members.organizationId, workspaceId)),
        db
            .select({ id: invitations.id })
            .from(invitations)
            .where(
                and(
                    eq(invitations.organizationId, workspaceId),
                    eq(invitations.status, "pending")
                )
            ),
        getActiveWorkspacePlanName(workspaceId)
    ])

    return {
        used: seatsInUse(memberRows.length, pendingInviteRows.length),
        cap: planName !== null ? planSeatCap(planName) : null
    }
}
