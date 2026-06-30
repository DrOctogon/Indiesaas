"use server"

import { revalidatePath } from "next/cache"
import {
    type ShiftChecklist,
    type ShiftChecklistInput,
    shiftChecklistInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { emitForEvent } from "@/lib/notify/dispatch"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Shift-checklist domain operations — clones the canonical daily-log pattern:
 * guard FIRST, construct the Repository from the auth context, validate
 * untrusted input with Zod at the boundary, and return a typed ActionResult
 * envelope (never throwing across the server/client boundary).
 */

const COLLECTION = "shiftChecklists" as const

/** List all shift checklists in the active workspace (view-gated). */
export async function listShiftChecklists(): Promise<
    ActionResult<ShiftChecklist[]>
> {
    try {
        const ctx = await requireAccess("checklist")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<ShiftChecklist>(COLLECTION))
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a shift checklist (write-gated to the `care` area). */
export async function createShiftChecklist(
    input: unknown
): Promise<ActionResult<ShiftChecklist>> {
    try {
        const ctx = await requireWrite("checklist", "care")
        const parsed = shiftChecklistInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<ShiftChecklistInput>(
            COLLECTION,
            parsed.data
        )
        await emitForEvent(
            {
                workspaceId: ctx.workspaceId,
                source: "checklist",
                action: "created",
                entityId: created.id,
                occurredAt: new Date().toISOString()
            },
            ctx.userId
        )
        revalidatePath("/care/checklist")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing shift checklist (write-gated). */
export async function updateShiftChecklist(
    id: string,
    patch: unknown
): Promise<ActionResult<ShiftChecklist>> {
    try {
        const ctx = await requireWrite("checklist", "care")
        const parsed = shiftChecklistInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<ShiftChecklist>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Shift checklist not found." }
        }
        revalidatePath("/care/checklist")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a shift checklist (write-gated). */
export async function deleteShiftChecklist(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("checklist", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Shift checklist not found." }
        }
        revalidatePath("/care/checklist")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
