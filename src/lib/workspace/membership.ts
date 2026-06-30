import type { RoleId } from "@/lib/rbac/access"

/**
 * Pure membership-lifecycle rules (see BUILD/04-rbac-permissions.md §member
 * management). No I/O — these decide *whether* an action is allowed given the
 * current member set; the org-plugin hooks in `auth.ts` load the members and
 * throw `LastAdminError` / `SeatCapError` when these return a violation.
 *
 * `membership_status` mapping onto Better Auth: `active` = a `members` row,
 * `invited` = a pending `invitations` row, `revoked` = a cancelled invitation.
 * `suspended` is carried as a flag inside the member record's metadata (Better
 * Auth has no native suspended state) and excluded from the active-admin count.
 */

export interface MemberLike {
    userId: string
    role: string
    /** True when the membership is deactivated (suspended) and must not count as active. */
    suspended?: boolean
}

export class LastAdminError extends Error {
    constructor(message = "Cannot remove or demote the last active admin") {
        super(message)
        this.name = "LastAdminError"
    }
}

export class SeatCapError extends Error {
    constructor(message = "Member seat cap reached for this plan") {
        super(message)
        this.name = "SeatCapError"
    }
}

const isActiveAdmin = (m: MemberLike): boolean =>
    m.role === "admin" && !m.suspended

/** Number of active (non-suspended) admins in the workspace. */
export function countActiveAdmins(members: readonly MemberLike[]): number {
    return members.filter(isActiveAdmin).length
}

/** Whether `userId` is the workspace's only active admin. */
export function isLastActiveAdmin(
    members: readonly MemberLike[],
    userId: string
): boolean {
    const admins = members.filter(isActiveAdmin)
    return admins.length === 1 && admins[0]?.userId === userId
}

/**
 * Guard for remove / leave / deactivate. Throws if the target is the last
 * active admin. Use before any operation that drops an admin from the active
 * set (remove member, leave workspace, deactivate, transfer-away).
 */
export function assertNotLastAdminRemoval(
    members: readonly MemberLike[],
    targetUserId: string
): void {
    if (isLastActiveAdmin(members, targetUserId)) {
        throw new LastAdminError()
    }
}

/**
 * Guard for role change. Throws if demoting the last active admin to a
 * non-admin role. Self-demote of a sole admin is the canonical blocked case.
 */
export function assertRoleChangeAllowed(
    members: readonly MemberLike[],
    targetUserId: string,
    newRole: RoleId
): void {
    if (newRole !== "admin" && isLastActiveAdmin(members, targetUserId)) {
        throw new LastAdminError("Cannot demote the last active admin")
    }
}

/** Seats consumed = active members + outstanding (pending) invitations. */
export function seatsInUse(
    activeMemberCount: number,
    pendingInviteCount: number
): number {
    return activeMemberCount + pendingInviteCount
}

/**
 * Guard for invite / add-member. Throws `SeatCapError` when accepting one more
 * member would exceed the plan's seat cap. A `seatCap` of `null` means
 * unlimited (e.g. billing unconfigured / no enforced cap).
 */
export function assertSeatAvailable(
    seatsConsumed: number,
    seatCap: number | null
): void {
    if (seatCap !== null && seatsConsumed >= seatCap) {
        throw new SeatCapError(
            `Member seat cap (${seatCap}) reached; upgrade the plan to invite more members`
        )
    }
}
