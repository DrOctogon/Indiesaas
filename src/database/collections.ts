import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { organizations, users } from "./schema"

/**
 * HomeCare domain data — the JSONB-uniform model (see BUILD/03-data-model.md).
 *
 * Every domain collection is its own table sharing one uniform shape: the full
 * typed domain object lives in `data` (jsonb); `id` and `workspace_id` are
 * mirrored as real columns for lookup/indexing. There is no relational
 * normalization — intra-domain references (recipientId, medicationId, …) are
 * plain string fields inside `data`, enforced by the generic Repository, not by
 * DB constraints. The one cross-cutting real FK on every domain row is
 * `workspace_id -> organizations.id`, and deleting a workspace cascades ALL of
 * its rows. App-generated prefixed string ids (e.g. "dl-1", "r-2") are written
 * by the Repository; UUIDs are reserved for the system/tenancy tables.
 */
function collection(name: string) {
    return pgTable(
        name,
        {
            id: text("id").primaryKey(),
            workspaceId: text("workspace_id")
                .notNull()
                .references(() => organizations.id, { onDelete: "cascade" }),
            data: jsonb("data").notNull(),
            createdAt: timestamp("created_at").defaultNow().notNull(),
            updatedAt: timestamp("updated_at").defaultNow().notNull()
        },
        (table) => [index(`${name}_workspace_idx`).on(table.workspaceId)]
    )
}

/**
 * User-global collection — keyed by `userId`, NOT workspace-scoped. An explicit
 * exception to the uniform `workspace_id` rule: a user's theme/locale and their
 * Web-Push endpoints span all of their workspaces.
 */
function userCollection(name: string) {
    return pgTable(
        name,
        {
            id: text("id").primaryKey(),
            userId: text("user_id")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
            data: jsonb("data").notNull(),
            createdAt: timestamp("created_at").defaultNow().notNull(),
            updatedAt: timestamp("updated_at").defaultNow().notNull()
        },
        (table) => [index(`${name}_user_idx`).on(table.userId)]
    )
}

// --- Care core (7) ---
export const recipients = collection("recipients")
export const vitals = collection("vitals")
export const medications = collection("medications")
export const medLogs = collection("medLogs")
export const visits = collection("visits")
export const careGoals = collection("careGoals")
export const careTasks = collection("careTasks")

// --- Caregiver / shift (3) ---
export const dailyLogs = collection("dailyLogs")
export const shiftChecklists = collection("shiftChecklists")
export const weeklyReports = collection("weeklyReports")

// --- Operations / admin (6) ---
export const alerts = collection("alerts")
export const actionItems = collection("actionItems")
export const contacts = collection("contacts")
export const documents = collection("documents")
export const budgetLines = collection("budgetLines")
export const operatingRhythms = collection("operatingRhythms")

// --- Household / estate (7) ---
export const properties = collection("properties")
export const homeSystems = collection("homeSystems")
export const maintenanceTasks = collection("maintenanceTasks")
export const vendors = collection("vendors")
export const tenants = collection("tenants")
export const guestStays = collection("guestStays")
export const inventory = collection("inventory")

// --- Events / planning (6) ---
export const events = collection("events")
export const eventTasks = collection("eventTasks")
export const routineItems = collection("routineItems")
export const mealPlan = collection("mealPlan")
export const favoriteMeals = collection("favoriteMeals")
export const activities = collection("activities")

// --- Protocols (1) ---
export const protocols = collection("protocols")

// --- Landscaping (3) ---
export const landscapingZones = collection("landscapingZones")
export const landscapingTasks = collection("landscapingTasks")
export const landscapingVendors = collection("landscapingVendors")

// --- Notification engine (3 workspace-scoped) ---
export const alertRules = collection("alertRules")
export const notificationPreferences = collection("notificationPreferences")
export const notificationDeliveries = collection("notificationDeliveries")

// --- Scheduling + care-task protocols (3) ---
export const scheduleOccurrences = collection("scheduleOccurrences")
export const careTaskProtocols = collection("careTaskProtocols")
export const careTaskCompletions = collection("careTaskCompletions")

// --- User-global exceptions (2) — keyed by userId, no workspace_id ---
export const notificationSubscriptions = userCollection(
    "notificationSubscriptions"
)
export const accountPreferences = userCollection("accountPreferences")

/**
 * Append-only audit trail. Written on every domain mutation (and auth events
 * where applicable), carrying the active workspace + actor. Never updated or
 * deleted. Surfaced per-workspace in the admin Audit Trail.
 */
export const auditLog = pgTable(
    "audit_log",
    {
        id: text("id").primaryKey(),
        // Nullable for auth events: a login carries no active workspace yet, and a
        // login_failed for an unknown email has no actor. Mutation rows always
        // populate both (written by the Repository).
        workspaceId: text("workspace_id").references(() => organizations.id, {
            onDelete: "cascade"
        }),
        actorUserId: text("actor_user_id").references(() => users.id, {
            onDelete: "cascade"
        }),
        action: text("action").notNull(), // create | update | delete | login | login_failed
        collection: text("collection").notNull(),
        entityId: text("entity_id"),
        before: jsonb("before"),
        after: jsonb("after"),
        ip: text("ip"),
        createdAt: timestamp("created_at").defaultNow().notNull()
    },
    (table) => [
        index("audit_log_workspace_created_idx").on(
            table.workspaceId,
            table.createdAt
        ),
        index("audit_log_actor_idx").on(table.actorUserId)
    ]
)

/**
 * Registry of workspace-scoped collections, keyed by collection name. The
 * generic Repository resolves a name to its table through this map; every entry
 * carries `workspace_id` and is auto-scoped to the active workspace.
 */
export const collections = {
    recipients,
    vitals,
    medications,
    medLogs,
    visits,
    careGoals,
    careTasks,
    dailyLogs,
    shiftChecklists,
    weeklyReports,
    alerts,
    actionItems,
    contacts,
    documents,
    budgetLines,
    operatingRhythms,
    properties,
    homeSystems,
    maintenanceTasks,
    vendors,
    tenants,
    guestStays,
    inventory,
    events,
    eventTasks,
    routineItems,
    mealPlan,
    favoriteMeals,
    activities,
    protocols,
    landscapingZones,
    landscapingTasks,
    landscapingVendors,
    alertRules,
    notificationPreferences,
    notificationDeliveries,
    scheduleOccurrences,
    careTaskProtocols,
    careTaskCompletions
} as const

/** Registry of user-global collections (keyed by userId, no workspace scope). */
export const userCollections = {
    notificationSubscriptions,
    accountPreferences
} as const

export type CollectionName = keyof typeof collections
export type UserCollectionName = keyof typeof userCollections
