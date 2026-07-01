"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { db } from "@/database/db"
import { members as membersTable } from "@/database/schema"
import { type ActionResult, fail, failFrom, ok } from "@/lib/domains/result"
import {
    type PendingInvitation,
    type WorkspaceMember,
    changeRoleInput,
    inviteMemberInput,
    memberIdInput,
    removeMemberInput,
    revokeInvitationInput,
    transferOwnershipInput
} from "@/lib/domains/system/types"
import { auth } from "@/lib/auth"
import { requireManage } from "@/lib/rbac/guards"
import { guardSuspendMember } from "@/lib/workspace/lifecycle"

/**
 * Members domain operations (System area, admin-only — navKey "members").
 *
 * Membership/invitation state lives in the Better Auth org plugin, so every op
 * delegates to `auth.api.*` rather than the generic Repository. The plugin's
 * org hooks (`auth.ts`) already enforce the last-active-admin and seat-cap
 * guards (`@/lib/workspace/lifecycle`); we don't re-implement them here — we
 * just surface friendly failures when those guards throw. Each op:
 *   1. calls `requireManage("members", ["admin"])` FIRST (fail-closed),
 *   2. validates untrusted input with Zod at the boundary,
 *   3. returns a typed `ActionResult`, never throwing across the boundary.
 */

const MEMBERS_PATH = "/admin/members"

/** List the active workspace's members (admin-only). */
export async function listMembers(): Promise<ActionResult<WorkspaceMember[]>> {
    try {
        const ctx = await requireManage("members", ["admin"])
        const requestHeaders = await headers()
        const result = await auth.api.listMembers({ headers: requestHeaders })
        // Better Auth's listMembers does not surface our custom `suspended`
        // column, so read it directly (workspace-scoped) and merge by member id.
        const statusRows = await db
            .select({ id: membersTable.id, suspended: membersTable.suspended })
            .from(membersTable)
            .where(eq(membersTable.organizationId, ctx.workspaceId))
        const suspendedById = new Map(
            statusRows.map((r) => [r.id, r.suspended])
        )
        const members: WorkspaceMember[] = result.members.map((m) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            name: m.user.name,
            email: m.user.email,
            suspended: suspendedById.get(m.id) ?? false,
            createdAt: m.createdAt
        }))
        return ok(members)
    } catch (error) {
        return failFrom(error)
    }
}

/** Invite a member by email + role (admin-only). Seat cap enforced by the plugin hook. */
export async function inviteMember(
    input: unknown
): Promise<ActionResult<{ email: string }>> {
    try {
        await requireManage("members", ["admin"])
        const parsed = inviteMemberInput.safeParse(input)
        if (!parsed.success) {
            return fail(parsed.error.issues[0]?.message ?? "Invalid invite.")
        }
        await auth.api.createInvitation({
            body: { email: parsed.data.email, role: parsed.data.role },
            headers: await headers()
        })
        revalidatePath(MEMBERS_PATH)
        return ok({ email: parsed.data.email })
    } catch (error) {
        return failFrom(error)
    }
}

/** Change a member's role (admin-only). Last-active-admin demotion blocked by the plugin hook. */
export async function changeMemberRole(
    input: unknown
): Promise<ActionResult<{ memberId: string }>> {
    try {
        await requireManage("members", ["admin"])
        const parsed = changeRoleInput.safeParse(input)
        if (!parsed.success) {
            return fail(
                parsed.error.issues[0]?.message ?? "Invalid role change."
            )
        }
        await auth.api.updateMemberRole({
            body: { memberId: parsed.data.memberId, role: parsed.data.role },
            headers: await headers()
        })
        revalidatePath(MEMBERS_PATH)
        return ok({ memberId: parsed.data.memberId })
    } catch (error) {
        return failFrom(error)
    }
}

/** Remove a member (admin-only). Last-active-admin removal blocked by the plugin hook. */
export async function removeMember(
    input: unknown
): Promise<ActionResult<{ memberIdOrEmail: string }>> {
    try {
        await requireManage("members", ["admin"])
        const parsed = removeMemberInput.safeParse(input)
        if (!parsed.success) {
            return fail(parsed.error.issues[0]?.message ?? "Invalid removal.")
        }
        await auth.api.removeMember({
            body: { memberIdOrEmail: parsed.data.memberIdOrEmail },
            headers: await headers()
        })
        revalidatePath(MEMBERS_PATH)
        return ok({ memberIdOrEmail: parsed.data.memberIdOrEmail })
    } catch (error) {
        return failFrom(error)
    }
}

/**
 * Resolve a member row by id, scoped to the active workspace. Returns null when
 * the id belongs to another workspace or does not exist — cross-workspace ids
 * are indistinguishable from missing ones.
 */
async function findWorkspaceMember(
    memberId: string,
    workspaceId: string
): Promise<{ userId: string } | null> {
    const [row] = await db
        .select({ userId: membersTable.userId })
        .from(membersTable)
        .where(
            and(
                eq(membersTable.id, memberId),
                eq(membersTable.organizationId, workspaceId)
            )
        )
    return row ?? null
}

/**
 * Suspend (deactivate) a member — reversible, not a hard delete (BUILD/06
 * invariant 9). Admin-only. Blocked when the target is the last active admin.
 */
export async function suspendMember(
    input: unknown
): Promise<ActionResult<{ memberId: string }>> {
    try {
        const ctx = await requireManage("members", ["admin"])
        const parsed = memberIdInput.safeParse(input)
        if (!parsed.success) {
            return fail(parsed.error.issues[0]?.message ?? "Invalid member.")
        }
        const member = await findWorkspaceMember(
            parsed.data.memberId,
            ctx.workspaceId
        )
        if (!member) {
            return fail("Member not found.")
        }
        try {
            // Throws LastAdminError if this would drop the last active admin.
            await guardSuspendMember(ctx.workspaceId, member.userId)
        } catch (guardError) {
            return fail(
                guardError instanceof Error
                    ? guardError.message
                    : "Cannot suspend the last active admin."
            )
        }
        await db
            .update(membersTable)
            .set({ suspended: true })
            .where(
                and(
                    eq(membersTable.id, parsed.data.memberId),
                    eq(membersTable.organizationId, ctx.workspaceId)
                )
            )
        revalidatePath(MEMBERS_PATH)
        return ok({ memberId: parsed.data.memberId })
    } catch (error) {
        return failFrom(error)
    }
}

/**
 * Reactivate a suspended member (admin-only). Never guarded — restoring a
 * member can only grow the active set, so it can't violate the last-admin rule.
 */
export async function reactivateMember(
    input: unknown
): Promise<ActionResult<{ memberId: string }>> {
    try {
        const ctx = await requireManage("members", ["admin"])
        const parsed = memberIdInput.safeParse(input)
        if (!parsed.success) {
            return fail(parsed.error.issues[0]?.message ?? "Invalid member.")
        }
        const member = await findWorkspaceMember(
            parsed.data.memberId,
            ctx.workspaceId
        )
        if (!member) {
            return fail("Member not found.")
        }
        await db
            .update(membersTable)
            .set({ suspended: false })
            .where(
                and(
                    eq(membersTable.id, parsed.data.memberId),
                    eq(membersTable.organizationId, ctx.workspaceId)
                )
            )
        revalidatePath(MEMBERS_PATH)
        return ok({ memberId: parsed.data.memberId })
    } catch (error) {
        return failFrom(error)
    }
}

/**
 * Transfer ownership (admin-only): promote the target member to admin and,
 * optionally, demote the current admin to a non-admin role. The target is
 * promoted FIRST so at least two admins exist before any self-demotion — the
 * last-active-admin guard (org hook) then permits the demotion.
 */
export async function transferOwnership(
    input: unknown
): Promise<ActionResult<{ targetMemberId: string }>> {
    try {
        const ctx = await requireManage("members", ["admin"])
        const parsed = transferOwnershipInput.safeParse(input)
        if (!parsed.success) {
            return fail(parsed.error.issues[0]?.message ?? "Invalid transfer.")
        }
        const target = await findWorkspaceMember(
            parsed.data.targetMemberId,
            ctx.workspaceId
        )
        if (!target) {
            return fail("Member not found.")
        }
        if (target.userId === ctx.userId) {
            return fail("Cannot transfer ownership to yourself.")
        }
        const requestHeaders = await headers()
        // Promote target to admin first (now two admins).
        await auth.api.updateMemberRole({
            body: { memberId: parsed.data.targetMemberId, role: "admin" },
            headers: requestHeaders
        })
        // Optionally step down; safe now that the target is already an admin.
        if (parsed.data.demoteSelfTo) {
            const self = await auth.api.getActiveMember({
                headers: requestHeaders
            })
            if (self?.id) {
                await auth.api.updateMemberRole({
                    body: {
                        memberId: self.id,
                        role: parsed.data.demoteSelfTo
                    },
                    headers: requestHeaders
                })
            }
        }
        revalidatePath(MEMBERS_PATH)
        return ok({ targetMemberId: parsed.data.targetMemberId })
    } catch (error) {
        return failFrom(error)
    }
}

/** List pending (unaccepted) invitations for the active workspace (admin-only). */
export async function listPendingInvitations(): Promise<
    ActionResult<PendingInvitation[]>
> {
    try {
        await requireManage("members", ["admin"])
        const result = await auth.api.listInvitations({
            headers: await headers()
        })
        const pending: PendingInvitation[] = result
            .filter((inv) => inv.status === "pending")
            .map((inv) => ({
                id: inv.id,
                email: inv.email,
                role: inv.role ?? "",
                status: inv.status,
                expiresAt: inv.expiresAt
            }))
        return ok(pending)
    } catch (error) {
        return failFrom(error)
    }
}

/** Revoke a pending invitation (admin-only). */
export async function revokeInvitation(
    input: unknown
): Promise<ActionResult<{ invitationId: string }>> {
    try {
        await requireManage("members", ["admin"])
        const parsed = revokeInvitationInput.safeParse(input)
        if (!parsed.success) {
            return fail(
                parsed.error.issues[0]?.message ?? "Invalid invitation."
            )
        }
        await auth.api.cancelInvitation({
            body: { invitationId: parsed.data.invitationId },
            headers: await headers()
        })
        revalidatePath(MEMBERS_PATH)
        return ok({ invitationId: parsed.data.invitationId })
    } catch (error) {
        return failFrom(error)
    }
}

/**
 * Resend a pending invitation email (admin-only). Reuses the invite input
 * (email + role) and Better Auth's `resend` flag, which re-sends the email for
 * an existing pending invite rather than creating a duplicate.
 */
export async function resendInvitation(
    input: unknown
): Promise<ActionResult<{ email: string }>> {
    try {
        await requireManage("members", ["admin"])
        const parsed = inviteMemberInput.safeParse(input)
        if (!parsed.success) {
            return fail(parsed.error.issues[0]?.message ?? "Invalid invite.")
        }
        await auth.api.createInvitation({
            body: {
                email: parsed.data.email,
                role: parsed.data.role,
                resend: true
            },
            headers: await headers()
        })
        revalidatePath(MEMBERS_PATH)
        return ok({ email: parsed.data.email })
    } catch (error) {
        return failFrom(error)
    }
}
