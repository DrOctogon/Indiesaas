"use server"

import { revalidatePath } from "next/cache"
import {
    type DailyLog,
    type DailyLogInput,
    dailyLogInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { type EscalationSignal, shouldEscalate } from "@/lib/engine/escalation"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Daily-log domain operations — the CANONICAL feature pattern other M3 areas
 * clone (see plan §M3). Every op:
 *   1. calls an RBAC guard FIRST (fail-closed; derives the `{userId, workspaceId}`),
 *   2. constructs the Repository from that context (tenant isolation by construction),
 *   3. validates untrusted input with Zod at the boundary,
 *   4. returns a typed `ActionResult` envelope, never throwing across the boundary.
 *
 * Alerts/notifications are NOT dispatched here — that is M4's `emitForEvent`.
 * On create we run the pure escalation engine and surface its signals so the UI
 * can flag them immediately; persisting alerts is wired in M4.
 */

const COLLECTION = "dailyLogs" as const

/** List all daily logs in the active workspace (view-gated). */
export async function listDailyLogs(): Promise<ActionResult<DailyLog[]>> {
    try {
        const ctx = await requireAccess("daily-log")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const logs = await repo.list<DailyLog>(COLLECTION)
        return ok(logs)
    } catch (error) {
        return failFrom(error)
    }
}

export interface CreatedDailyLog {
    log: DailyLog
    escalations: EscalationSignal[]
}

/** Create a daily log (write-gated to the `care` area), returning escalation hints. */
export async function createDailyLog(
    input: unknown
): Promise<ActionResult<CreatedDailyLog>> {
    try {
        const ctx = await requireWrite("daily-log", "care")
        const parsed = dailyLogInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const log = await repo.create<DailyLogInput>(COLLECTION, parsed.data)
        const escalations = shouldEscalate(log)
        revalidatePath("/care/daily-log")
        return ok({ log, escalations })
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing daily log (write-gated). Null id-miss → failure envelope. */
export async function updateDailyLog(
    id: string,
    patch: unknown
): Promise<ActionResult<DailyLog>> {
    try {
        const ctx = await requireWrite("daily-log", "care")
        const parsed = dailyLogInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<DailyLog>(COLLECTION, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Daily log not found." }
        }
        revalidatePath("/care/daily-log")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a daily log (write-gated). */
export async function deleteDailyLog(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("daily-log", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Daily log not found." }
        }
        revalidatePath("/care/daily-log")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
