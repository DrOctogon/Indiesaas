import { z } from "zod"
import { ROLE_IDS } from "@/lib/rbac/access"

/**
 * System-area types + input validation (admin-only: audit, members, workspace).
 *
 * Membership and workspace mutations go through the Better Auth org plugin
 * (`auth.api.*`), NOT the generic Repository — so these schemas validate the
 * untrusted client input at the server-action boundary before it is handed to
 * Better Auth. The audit feature is read-only and shapes its rows from the
 * `audit_log` table directly.
 */

/** One of the four domain roles, validated from untrusted input. */
export const roleId = z.enum(ROLE_IDS)

/** Invite a member: email + role. */
export const inviteMemberInput = z
    .object({
        email: z.string().email("A valid email is required"),
        role: roleId
    })
    .strict()

export type InviteMemberInput = z.infer<typeof inviteMemberInput>

/** Change a member's role: the member row id + the new role. */
export const changeRoleInput = z
    .object({
        memberId: z.string().min(1, "memberId is required"),
        role: roleId
    })
    .strict()

export type ChangeRoleInput = z.infer<typeof changeRoleInput>

/** Remove a member: their member row id or email. */
export const removeMemberInput = z
    .object({
        memberIdOrEmail: z.string().min(1, "A member id or email is required")
    })
    .strict()

export type RemoveMemberInput = z.infer<typeof removeMemberInput>

/** Suspend or reactivate a member: their member row id. */
export const memberIdInput = z
    .object({
        memberId: z.string().min(1, "memberId is required")
    })
    .strict()

export type MemberIdInput = z.infer<typeof memberIdInput>

/**
 * Transfer ownership: promote the target member to admin, optionally demoting
 * the current admin to a non-admin role (omit to co-own as two admins).
 */
export const transferOwnershipInput = z
    .object({
        targetMemberId: z.string().min(1, "targetMemberId is required"),
        demoteSelfTo: z.enum(["caregiver", "family", "household"]).optional()
    })
    .strict()

export type TransferOwnershipInput = z.infer<typeof transferOwnershipInput>

/** Update workspace settings: name (timezone lives in metadata). */
export const workspaceSettingsInput = z
    .object({
        name: z.string().min(1, "Workspace name is required").max(120),
        timezone: z.string().min(1).max(64).optional()
    })
    .strict()

export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsInput>

/** A single audit-log row surfaced read-only in the admin Audit Trail. */
export interface AuditEntry {
    id: string
    workspaceId: string
    actorUserId: string
    action: string
    collection: string
    entityId: string | null
    before: unknown
    after: unknown
    ip: string | null
    createdAt: Date
}

/** A workspace member as surfaced in the admin Members table. */
export interface WorkspaceMember {
    id: string
    userId: string
    role: string
    name: string
    email: string
    suspended: boolean
    createdAt: Date
}

/** Active workspace settings surfaced in the admin Workspace page. */
export interface WorkspaceSettings {
    id: string
    name: string
    slug: string
    timezone?: string
}
