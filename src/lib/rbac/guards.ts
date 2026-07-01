import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { ROLE_IDS, type RoleId } from "@/lib/rbac/access"
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac/errors"
import { type NavKey, type WriteArea, can, canWrite } from "@/lib/rbac/matrix"

/**
 * Server-authoritative authorization guards (see BUILD/04-rbac-permissions.md).
 *
 * Every data-touching server operation calls one of these first. Each guard
 * asserts, in order: an authenticated user → an active workspace → active
 * membership in it → the role check. All failures throw and fail closed. The
 * returned `AuthContext` carries the `workspaceId` every downstream query must
 * scope by (the Repository is constructed from it). The client-side gate is
 * cosmetic; these are the real gates.
 *
 * The error classes live in the dependency-free `./errors` leaf so consumers
 * that only pattern-match on them don't transitively import `@/lib/auth`
 * (Stripe at module load); re-exported here for existing callers.
 */

export { ForbiddenError, UnauthorizedError } from "@/lib/rbac/errors"

export interface AuthContext {
    userId: string
    workspaceId: string
    role: RoleId
}

function toRoleId(role: string | null | undefined): RoleId | null {
    return ROLE_IDS.includes(role as RoleId) ? (role as RoleId) : null
}

/**
 * Outermost gate: authenticated user who is an active member of the active
 * workspace. Resolves the effective role from the active membership. Throws
 * `UnauthorizedError` (not signed in) or `ForbiddenError` (no active workspace /
 * not a member / unknown role).
 */
export async function requireWorkspace(): Promise<AuthContext> {
    const requestHeaders = await headers()
    const session = await auth.api.getSession({ headers: requestHeaders })
    if (!session?.user) {
        throw new UnauthorizedError()
    }

    let member: { organizationId: string; role: string } | null = null
    try {
        member = await auth.api.getActiveMember({ headers: requestHeaders })
    } catch {
        member = null
    }
    if (!member) {
        throw new ForbiddenError("No active workspace membership")
    }

    const role = toRoleId(member.role)
    if (!role) {
        throw new ForbiddenError("Unknown role on active membership")
    }

    return {
        userId: session.user.id,
        workspaceId: member.organizationId,
        role
    }
}

/** View gate — throws `ForbiddenError` if the role cannot view `navKey`. */
export async function requireAccess(navKey: NavKey): Promise<AuthContext> {
    const context = await requireWorkspace()
    if (!can(context.role, navKey)) {
        throw new ForbiddenError(`No view access to '${navKey}'`)
    }
    return context
}

/** Write gate — requires both `can(navKey)` and `canWrite(area)`. */
export async function requireWrite(
    navKey: NavKey,
    area: WriteArea
): Promise<AuthContext> {
    const context = await requireWorkspace()
    if (!can(context.role, navKey) || !canWrite(context.role, area)) {
        throw new ForbiddenError(`No write access to '${navKey}' (${area})`)
    }
    return context
}

/** Manage gate — requires `can(navKey)` AND the role to be in an explicit role set. */
export async function requireManage(
    navKey: NavKey,
    roles: readonly RoleId[]
): Promise<AuthContext> {
    const context = await requireWorkspace()
    if (!can(context.role, navKey) || !roles.includes(context.role)) {
        throw new ForbiddenError(`Role not permitted to manage '${navKey}'`)
    }
    return context
}
