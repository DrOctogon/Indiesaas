"use server"

import { revalidatePath } from "next/cache"
import {
    type Vital,
    type VitalInput,
    vitalInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Vitals domain operations — clones the canonical daily-log pattern: guard
 * FIRST, construct the Repository from the auth context, validate untrusted
 * input with Zod at the boundary, return a typed ActionResult envelope.
 */

const COLLECTION = "vitals" as const

/** List all vitals in the active workspace (view-gated). */
export async function listVitals(): Promise<ActionResult<Vital[]>> {
    try {
        const ctx = await requireAccess("vitals")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<Vital>(COLLECTION))
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a vital reading (write-gated to the `care` area). */
export async function createVital(
    input: unknown
): Promise<ActionResult<Vital>> {
    try {
        const ctx = await requireWrite("vitals", "care")
        const parsed = vitalInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<VitalInput>(COLLECTION, parsed.data)
        revalidatePath("/care/vitals")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing vital (write-gated). */
export async function updateVital(
    id: string,
    patch: unknown
): Promise<ActionResult<Vital>> {
    try {
        const ctx = await requireWrite("vitals", "care")
        const parsed = vitalInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Vital>(COLLECTION, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Vital not found." }
        }
        revalidatePath("/care/vitals")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a vital (write-gated). */
export async function deleteVital(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("vitals", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Vital not found." }
        }
        revalidatePath("/care/vitals")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
