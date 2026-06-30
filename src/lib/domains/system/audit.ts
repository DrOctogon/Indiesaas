"use server"

import { desc, eq } from "drizzle-orm"
import { auditLog } from "@/database/collections"
import { db } from "@/database/db"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import type { AuditEntry } from "@/lib/domains/system/types"
import { requireManage } from "@/lib/rbac/guards"

/**
 * Audit Trail read helper (System area, admin-only — navKey "audit").
 *
 * Read-only. The `audit_log` table is workspace-system, not a domain collection,
 * so it is read through `db` directly rather than the generic Repository — but
 * still strictly scoped to the active workspace from the guard context (tenant
 * isolation invariant). Newest first; bounded page size so the admin view never
 * pulls an unbounded result set.
 */

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

/** List audit-log entries for the active workspace (admin-only, newest first). */
export async function listAuditEntries(
    limit: number = DEFAULT_LIMIT
): Promise<ActionResult<AuditEntry[]>> {
    try {
        const ctx = await requireManage("audit", ["admin"])
        const take = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT)
        const rows = await db
            .select()
            .from(auditLog)
            .where(eq(auditLog.workspaceId, ctx.workspaceId))
            .orderBy(desc(auditLog.createdAt))
            .limit(take)
        return ok(rows as AuditEntry[])
    } catch (error) {
        return failFrom(error)
    }
}
