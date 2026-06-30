"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { type ActionResult, fail, failFrom, ok } from "@/lib/domains/result"
import {
    type WorkspaceMember,
    changeRoleInput,
    inviteMemberInput,
    removeMemberInput
} from "@/lib/domains/system/types"
import { auth } from "@/lib/auth"
import { requireManage } from "@/lib/rbac/guards"

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
        await requireManage("members", ["admin"])
        const requestHeaders = await headers()
        const result = await auth.api.listMembers({ headers: requestHeaders })
        const members: WorkspaceMember[] = result.members.map((m) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            name: m.user.name,
            email: m.user.email,
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
