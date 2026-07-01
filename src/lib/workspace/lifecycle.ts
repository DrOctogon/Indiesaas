import { and, eq } from "drizzle-orm"
import { db } from "@/database/db"
import { invitations, members } from "@/database/schema"
import {
    getActiveWorkspacePlanName,
    planSeatCap
} from "@/lib/domains/system/seats"
import type { RoleId } from "@/lib/rbac/access"
import {
    type MemberLike,
    assertNotLastAdminRemoval,
    assertRoleChangeAllowed,
    assertSeatAvailable,
    seatsInUse
} from "@/lib/workspace/membership"

/**
 * DB-backed membership lifecycle guards, called from the org-plugin hooks in
 * `auth.ts`. Each loads the workspace's current members/invitations and defers
 * the decision to the pure helpers in `./membership`, throwing on violation so
 * Better Auth aborts the mutation. Everything is scoped to one workspace.
 */

async function loadMembers(workspaceId: string): Promise<MemberLike[]> {
    const rows = await db
        .select({
            userId: members.userId,
            role: members.role,
            suspended: members.suspended
        })
        .from(members)
        .where(eq(members.organizationId, workspaceId))
    return rows
}

/** Block removing / deactivating / leaving as the last active admin. */
export async function guardRemoveMember(
    workspaceId: string,
    targetUserId: string
): Promise<void> {
    assertNotLastAdminRemoval(await loadMembers(workspaceId), targetUserId)
}

/** Block demoting the last active admin. */
export async function guardRoleChange(
    workspaceId: string,
    targetUserId: string,
    newRole: RoleId
): Promise<void> {
    assertRoleChangeAllowed(
        await loadMembers(workspaceId),
        targetUserId,
        newRole
    )
}

/**
 * Block suspending (deactivating) the last active admin. Suspension drops the
 * target from the active set exactly like removal, so it reuses the same guard.
 */
export async function guardSuspendMember(
    workspaceId: string,
    targetUserId: string
): Promise<void> {
    assertNotLastAdminRemoval(await loadMembers(workspaceId), targetUserId)
}

/**
 * Resolve the workspace's member seat cap from its active Stripe plan.
 *
 * Returns the plan's `limits.seats` when the workspace has an active (or
 * trialing) subscription whose plan defines a seat cap; otherwise `null`, which
 * `assertSeatAvailable` treats as unlimited. `null` covers every "no enforced
 * cap" case: billing unconfigured, free plan, no active subscription, or a plan
 * without a configured seat number.
 *
 * FAIL OPEN: any lookup failure (e.g. Stripe/DB transiently unavailable) is
 * swallowed and returns `null` rather than throwing. This path gates member
 * invites — we deliberately do NOT block inviting members because the billing
 * lookup failed. The trade-off is that a transient failure could briefly let an
 * invite exceed the cap; enforcement resumes once the lookup recovers. This is
 * preferable to coupling invite availability to billing uptime.
 */
export async function getWorkspaceSeatCap(
    workspaceId: string
): Promise<number | null> {
    try {
        const planName = await getActiveWorkspacePlanName(workspaceId)
        if (planName === null) {
            return null
        }
        return planSeatCap(planName)
    } catch {
        return null
    }
}

/** Block an invite that would exceed the plan's seat cap (active members + pending invites). */
export async function guardInviteSeat(workspaceId: string): Promise<void> {
    const [activeMembers, pendingInvites, seatCap] = await Promise.all([
        loadMembers(workspaceId),
        db
            .select({ id: invitations.id })
            .from(invitations)
            .where(
                and(
                    eq(invitations.organizationId, workspaceId),
                    eq(invitations.status, "pending")
                )
            ),
        getWorkspaceSeatCap(workspaceId)
    ])
    assertSeatAvailable(
        seatsInUse(activeMembers.length, pendingInvites.length),
        seatCap
    )
}
