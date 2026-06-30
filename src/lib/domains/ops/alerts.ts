"use server"

import { revalidatePath } from "next/cache"
import {
    type Alert,
    type AlertInput,
    alertInput
} from "@/lib/domains/ops/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireManage, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Alert domain operations (see BUILD/02 §Alerts, BUILD/04 §manage role-sets).
 * Guard-first, fail-closed, returns the `ActionResult` envelope — clones the
 * canonical daily-log pattern.
 *
 * Guard mapping (BUILD/04 line 108):
 *   - list/view → requireAccess("alerts")
 *   - acknowledge → requireWrite("alerts", "alertAck")  (all roles may ack)
 *   - create / remove → requireManage("alerts", [admin, caregiver, household])
 *   - update (other fields) reuses the create/remove manage set.
 *
 * Engine-generated alerts are persisted by M4's emitForEvent; these ops cover
 * the manual raise/acknowledge/resolve/delete UI path.
 */

const COLLECTION = "alerts" as const
const MANAGE_ROLES = ["admin", "caregiver", "household"] as const

/** List all alerts in the active workspace (view-gated). */
export async function listAlerts(): Promise<ActionResult<Alert[]>> {
    try {
        const ctx = await requireAccess("alerts")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const alerts = await repo.list<Alert>(COLLECTION)
        return ok(alerts)
    } catch (error) {
        return failFrom(error)
    }
}

/** Raise a manual alert (managed by admin/caregiver/household). */
export async function createAlert(
    input: unknown
): Promise<ActionResult<Alert>> {
    try {
        const ctx = await requireManage("alerts", MANAGE_ROLES)
        const parsed = alertInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const alert = await repo.create<AlertInput>(COLLECTION, parsed.data)
        revalidatePath("/ops/alerts")
        return ok(alert)
    } catch (error) {
        return failFrom(error)
    }
}

/** Acknowledge an alert — write area `alertAck` (all roles permitted). */
export async function acknowledgeAlert(
    id: string
): Promise<ActionResult<Alert>> {
    try {
        const ctx = await requireWrite("alerts", "alertAck")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Alert>(COLLECTION, id, {
            status: "acknowledged",
            acknowledgedBy: ctx.userId,
            acknowledgedAt: new Date().toISOString()
        })
        if (!updated) {
            return { status: false, message: "Alert not found." }
        }
        revalidatePath("/ops/alerts")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Resolve an alert (managed by admin/caregiver/household). */
export async function resolveAlert(id: string): Promise<ActionResult<Alert>> {
    try {
        const ctx = await requireManage("alerts", MANAGE_ROLES)
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Alert>(COLLECTION, id, {
            status: "resolved",
            resolvedBy: ctx.userId,
            resolvedAt: new Date().toISOString()
        })
        if (!updated) {
            return { status: false, message: "Alert not found." }
        }
        revalidatePath("/ops/alerts")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an alert's fields (managed by admin/caregiver/household). */
export async function updateAlert(
    id: string,
    patch: unknown
): Promise<ActionResult<Alert>> {
    try {
        const ctx = await requireManage("alerts", MANAGE_ROLES)
        const parsed = alertInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Alert>(COLLECTION, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Alert not found." }
        }
        revalidatePath("/ops/alerts")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete an alert (managed by admin/caregiver/household). */
export async function deleteAlert(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireManage("alerts", MANAGE_ROLES)
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Alert not found." }
        }
        revalidatePath("/ops/alerts")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
