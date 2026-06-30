import { randomUUID } from "node:crypto"
import { type SQL, and, eq, sql } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"
import {
    type CollectionName,
    auditLog,
    collections
} from "@/database/collections"
import { db } from "@/database/db"

/**
 * The single data seam for all workspace-scoped domain data (see
 * BUILD/03-data-model.md §Repository seam). Constructed with the actor's
 * `userId` and the active `workspaceId`, it auto-scopes EVERY read and write by
 * `workspace_id` and appends a before/after audit row on every mutation.
 *
 * TENANT ISOLATION (the #1 invariant) is enforced here and only here — feature
 * code must go through this class and must never touch a collection table or
 * the raw `db` client directly. A query that forgets the workspace filter is a
 * cross-tenant leak; centralising the filter makes that impossible by
 * construction.
 *
 * Storage is JSONB-uniform: the full typed domain object lives in `data`; `id`
 * and `workspace_id` are mirrored columns. Updates are read-modify-write
 * (shallow merge). Ids are app-generated, collection-prefixed strings.
 */

type Row = { id: string; data: unknown }
type Entity = Record<string, unknown> & { id: string }

/** Collection-prefixed id stems (see BUILD/03 §ID conventions). */
const ID_PREFIX: Record<CollectionName, string> = {
    recipients: "r",
    vitals: "v",
    medications: "m",
    medLogs: "ml",
    visits: "vi",
    careGoals: "g",
    careTasks: "t",
    dailyLogs: "dl",
    shiftChecklists: "cl",
    weeklyReports: "wr",
    alerts: "al",
    actionItems: "ai",
    contacts: "co",
    documents: "doc",
    budgetLines: "bl",
    operatingRhythms: "or",
    properties: "pr",
    homeSystems: "hs",
    maintenanceTasks: "mt",
    vendors: "ve",
    tenants: "te",
    guestStays: "gs",
    inventory: "in",
    events: "ev",
    eventTasks: "et",
    routineItems: "ro",
    mealPlan: "mp",
    favoriteMeals: "fav",
    activities: "ac",
    protocols: "po",
    landscapingZones: "lz",
    landscapingTasks: "lt",
    landscapingVendors: "lv",
    alertRules: "ar",
    notificationPreferences: "np",
    notificationDeliveries: "nd",
    scheduleOccurrences: "so",
    careTaskProtocols: "ctp",
    careTaskCompletions: "ctc"
}

/**
 * Intra-domain delete cascades (see BUILD/03 §Relationships). When a parent is
 * removed, its children — matched by the named JSON field equalling the parent
 * id, always within the same workspace — are removed too. The workspace-level
 * cascade (delete workspace → all rows) is a DB FK and lives in the schema.
 */
const CASCADES: Partial<
    Record<CollectionName, { collection: CollectionName; field: string }[]>
> = {
    recipients: [
        { collection: "vitals", field: "recipientId" },
        { collection: "medications", field: "recipientId" },
        { collection: "medLogs", field: "recipientId" },
        { collection: "visits", field: "recipientId" },
        { collection: "careGoals", field: "recipientId" },
        { collection: "careTasks", field: "recipientId" }
    ],
    medications: [{ collection: "medLogs", field: "medicationId" }],
    visits: [{ collection: "scheduleOccurrences", field: "visitId" }],
    events: [{ collection: "eventTasks", field: "eventId" }],
    landscapingZones: [{ collection: "landscapingTasks", field: "zoneId" }]
}

type AuditAction = "create" | "update" | "delete"

function tbl(name: CollectionName): PgTable {
    return collections[name] as unknown as PgTable
}

function jsonField(name: CollectionName, field: string): SQL {
    return sql`${collections[name]}.data ->> ${field}`
}

export class Repository {
    constructor(
        private readonly userId: string,
        private readonly workspaceId: string
    ) {}

    private newId(collection: CollectionName): string {
        return `${ID_PREFIX[collection]}-${randomUUID()}`
    }

    private scoped(name: CollectionName): SQL {
        return eq(collections[name].workspaceId, this.workspaceId)
    }

    private async audit(
        action: AuditAction,
        collection: CollectionName,
        entityId: string,
        before: unknown,
        after: unknown
    ): Promise<void> {
        await db.insert(auditLog).values({
            id: randomUUID(),
            workspaceId: this.workspaceId,
            actorUserId: this.userId,
            action,
            collection,
            entityId,
            before: before ?? null,
            after: after ?? null
        })
    }

    /** All rows in a collection for the active workspace. */
    async list<T = Entity>(collection: CollectionName): Promise<T[]> {
        const t = collections[collection]
        const rows = (await db
            .select({ id: t.id, data: t.data })
            .from(tbl(collection))
            .where(this.scoped(collection))) as Row[]
        return rows.map((r) => r.data as T)
    }

    /** One row by id, scoped to the active workspace. Null if not found / other workspace. */
    async get<T = Entity>(
        collection: CollectionName,
        id: string
    ): Promise<T | null> {
        const t = collections[collection]
        const rows = (await db
            .select({ id: t.id, data: t.data })
            .from(tbl(collection))
            .where(and(this.scoped(collection), eq(t.id, id)))
            .limit(1)) as Row[]
        return rows.length ? (rows[0]?.data as T) : null
    }

    /** Create a row with an app-generated id; writes a create audit row. */
    async create<T extends Record<string, unknown> = Entity>(
        collection: CollectionName,
        draft: T
    ): Promise<T & { id: string }> {
        const id = this.newId(collection)
        const data = { ...draft, id }
        await db.insert(tbl(collection)).values({
            id,
            workspaceId: this.workspaceId,
            data
        } as never)
        await this.audit("create", collection, id, null, data)
        return data
    }

    /**
     * Read-modify-write update: loads `before`, shallow-merges
     * `{ ...before, ...patch, id }`, bumps `updated_at`, writes a before/after
     * audit row. Returns null if the row doesn't exist in this workspace.
     */
    async update<T extends Record<string, unknown> = Entity>(
        collection: CollectionName,
        id: string,
        patch: Partial<T>
    ): Promise<(T & { id: string }) | null> {
        const before = await this.get<Record<string, unknown>>(collection, id)
        if (!before) return null
        const after = { ...before, ...patch, id }
        const t = collections[collection]
        await db
            .update(tbl(collection))
            .set({ data: after, updatedAt: new Date() } as never)
            .where(and(this.scoped(collection), eq(t.id, id)))
        await this.audit("update", collection, id, before, after)
        return after as T & { id: string }
    }

    /** Delete a row and cascade its intra-domain children; audits each delete. */
    async remove(collection: CollectionName, id: string): Promise<boolean> {
        const before = await this.get<Record<string, unknown>>(collection, id)
        if (!before) return false
        const t = collections[collection]
        await db
            .delete(tbl(collection))
            .where(and(this.scoped(collection), eq(t.id, id)))
        await this.audit("delete", collection, id, before, null)

        for (const child of CASCADES[collection] ?? []) {
            await this.removeWhere(child.collection, child.field, id)
        }
        return true
    }

    /**
     * Delete every row in `collection` whose JSON `field` equals `value`, within
     * the active workspace; audits each. Used for cascade-style deletes.
     */
    async removeWhere(
        collection: CollectionName,
        field: string,
        value: string
    ): Promise<number> {
        const matched = (await db
            .select({
                id: collections[collection].id,
                data: collections[collection].data
            })
            .from(tbl(collection))
            .where(
                and(
                    this.scoped(collection),
                    eq(jsonField(collection, field), value)
                )
            )) as Row[]
        if (matched.length === 0) return 0

        await db
            .delete(tbl(collection))
            .where(
                and(
                    this.scoped(collection),
                    eq(jsonField(collection, field), value)
                )
            )
        for (const row of matched) {
            await this.audit("delete", collection, row.id, row.data, null)
            for (const child of CASCADES[collection] ?? []) {
                await this.removeWhere(child.collection, child.field, row.id)
            }
        }
        return matched.length
    }
}
