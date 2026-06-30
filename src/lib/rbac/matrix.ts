import type { RoleId } from "@/lib/rbac/access"

/**
 * Authoritative RBAC matrices (see BUILD/04-rbac-permissions.md).
 *
 * Authorization answers two questions in order, both workspace-scoped:
 *   (1) is the requester an active member of the active workspace? (enforced by
 *       the server guards, outside this file)
 *   (2) does the member's role permit the action? (this file)
 *
 * Everything fails closed: no role → deny, unmapped nav key → deny, unknown
 * write area → deny. `admin` is a workspace admin (not a platform superadmin):
 * it always passes the view + write checks *within its own workspace only*.
 */

/** Every navigable feature key. The old `client` key merged into `recipients`; `memories` was dropped. */
export type NavKey =
    | "dashboard"
    | "recipients"
    | "daily-log"
    | "checklist"
    | "goals"
    | "weekly-report"
    | "plans"
    | "vitals"
    | "health"
    | "schedule"
    | "tasks"
    | "trends"
    | "alerts"
    | "action-items"
    | "rhythm"
    | "budget"
    | "documents"
    | "contacts"
    | "property"
    | "maintenance"
    | "vendors"
    | "tenants"
    | "inventory"
    | "landscaping"
    | "notifications"
    | "events"
    | "audit"
    | "members"
    | "workspace"
    | "billing"
    | "account"

/** Write areas for `canWrite(role, area)`. */
export type WriteArea = "care" | "household" | "events" | "admin" | "alertAck"

/**
 * View matrix — `roleAccess[navKey]` lists the NON-admin roles with view access.
 * `admin` is omitted everywhere because it always passes (see `can`). An empty
 * array means admin-only (budget, documents, tenants, audit, members,
 * workspace, billing). An unmapped key fails closed in `can`.
 */
const roleAccess: Record<NavKey, RoleId[]> = {
    dashboard: ["caregiver", "family", "household"],
    recipients: ["caregiver", "family"],
    "daily-log": ["caregiver"],
    checklist: ["caregiver"],
    goals: ["caregiver", "family"],
    "weekly-report": ["caregiver", "family"],
    plans: ["caregiver"],
    vitals: ["caregiver"],
    health: ["caregiver"],
    schedule: ["caregiver", "family"],
    tasks: ["caregiver"],
    trends: ["caregiver", "family"],
    alerts: ["caregiver", "family"],
    "action-items": ["caregiver", "family", "household"],
    rhythm: ["household"],
    budget: [], // admin-only
    documents: [], // admin-only
    contacts: ["caregiver", "family", "household"],
    property: ["household"],
    maintenance: ["household"],
    vendors: ["household"],
    tenants: [], // admin-only
    inventory: ["household"],
    landscaping: ["household"],
    notifications: ["caregiver", "family", "household"],
    events: ["family", "household"],
    audit: [], // admin-only
    members: [], // admin-only
    workspace: [], // admin-only
    billing: [], // admin-only
    account: ["caregiver", "family", "household"]
}

/** Write matrix — which roles may write each area. `admin` writes care/household/events/admin; all roles may acknowledge alerts. */
const writeAccess: Record<WriteArea, RoleId[]> = {
    care: ["admin", "caregiver"],
    household: ["admin", "household"],
    events: ["admin", "household"],
    admin: ["admin"],
    alertAck: ["admin", "caregiver", "family", "household"]
}

/**
 * Nav-level view check. Fails closed: no role → deny; `admin` → allow (within
 * its workspace); unmapped key → deny; otherwise allow iff role has view access.
 */
export function can(role: RoleId | null | undefined, navKey: NavKey): boolean {
    if (!role) return false
    if (role === "admin") return true
    const allowed = roleAccess[navKey]
    if (!allowed) return false
    return allowed.includes(role)
}

/** Write-area check. Fails closed: no role → deny; unknown area → deny. `admin` is included explicitly per area. */
export function canWrite(
    role: RoleId | null | undefined,
    area: WriteArea
): boolean {
    if (!role) return false
    const allowed = writeAccess[area]
    if (!allowed) return false
    return allowed.includes(role)
}

/** Whether a nav key is admin-only (no non-admin role has view access). */
export function isAdminOnly(navKey: NavKey): boolean {
    const allowed = roleAccess[navKey]
    return Array.isArray(allowed) && allowed.length === 0
}
