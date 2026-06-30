import { type Role, createAccessControl } from "better-auth/plugins/access"
import {
    adminAc,
    defaultStatements
} from "better-auth/plugins/organization/access"

/**
 * Better Auth organization access-control for HomeCare.
 *
 * A workspace = a Better Auth organization. A membership = an organization
 * member carrying exactly one of the four domain roles below. This file governs
 * only the *organization-plugin* permissions (who may invite/manage members,
 * update or delete the workspace). The richer, feature-level authorization —
 * the view matrix `can(role, navKey)` and write matrix `canWrite(role, area)` —
 * lives in app code (see `src/lib/rbac/matrix.ts`, built in M1) and is the
 * authoritative gate for every server action.
 *
 * Tenant isolation is enforced separately and centrally in the repository
 * (every query filtered by `workspace_id`); these roles never cross workspaces.
 */
export const statement = {
    ...defaultStatements
} as const

export const ac = createAccessControl(statement)

// better-auth's `Role` is generic over (and invariant in) its statement subset,
// so the full-perm admin role and the empty member-level roles below are not
// mutually assignable. Erase the per-role statement generic to the loose `Role`
// so all four can sit in one record passed to `organization({ roles })`.
const asRole = (role: unknown): Role => role as Role

/** Workspace owner. Sole role permitted to manage members, billing, and the workspace itself. */
export const admin = asRole(ac.newRole({ ...adminAc.statements }))

/** Paid caregiver. Member-level on the org; care-write permissions are enforced app-side. */
export const caregiver = asRole(ac.newRole({}))

/** Family member (read-only). Member-level on the org; no care writes. */
export const family = asRole(ac.newRole({}))

/** Estate / household manager. Member-level on the org; household-write enforced app-side. */
export const household = asRole(ac.newRole({}))

export const roles = { admin, caregiver, family, household }

/** The four domain role ids, in canonical order. */
export const ROLE_IDS = ["admin", "caregiver", "family", "household"] as const
export type RoleId = (typeof ROLE_IDS)[number]
