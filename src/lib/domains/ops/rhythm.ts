"use server"

import { revalidatePath } from "next/cache"
import {
    type OperatingRhythm,
    type OperatingRhythmInput,
    operatingRhythmInput
} from "@/lib/domains/ops/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Operating-rhythm domain operations (see BUILD/02 §Operating Rhythm — Write:
 * admin, household). Guard-first, fail-closed, returns the `ActionResult`
 * envelope. Writes map to the `household` write area (admin + household).
 */

const COLLECTION = "operatingRhythms" as const

/** List all operating rhythms in the active workspace (view-gated). */
export async function listOperatingRhythms(): Promise<
    ActionResult<OperatingRhythm[]>
> {
    try {
        const ctx = await requireAccess("rhythm")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const rhythms = await repo.list<OperatingRhythm>(COLLECTION)
        return ok(rhythms)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create an operating rhythm (write area `household`). */
export async function createOperatingRhythm(
    input: unknown
): Promise<ActionResult<OperatingRhythm>> {
    try {
        const ctx = await requireWrite("rhythm", "household")
        const parsed = operatingRhythmInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const rhythm = await repo.create<OperatingRhythmInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/ops/rhythm")
        return ok(rhythm)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an operating rhythm (write area `household`). */
export async function updateOperatingRhythm(
    id: string,
    patch: unknown
): Promise<ActionResult<OperatingRhythm>> {
    try {
        const ctx = await requireWrite("rhythm", "household")
        const parsed = operatingRhythmInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<OperatingRhythm>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Operating rhythm not found." }
        }
        revalidatePath("/ops/rhythm")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete an operating rhythm (write area `household`). */
export async function deleteOperatingRhythm(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("rhythm", "household")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Operating rhythm not found." }
        }
        revalidatePath("/ops/rhythm")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
