import { and, eq } from "drizzle-orm"
import { db } from "@/database/db"
import { invitations, members } from "@/database/schema"
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
        .select({ userId: members.userId, role: members.role })
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
 * Resolve the workspace's member seat cap. `null` = no enforced cap (billing
 * unconfigured / free plan). The per-plan seat cap is wired in M4 (billing);
 * until then invites are uncapped.
 */
export async function getWorkspaceSeatCap(
    _workspaceId: string
): Promise<number | null> {
    return null
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
