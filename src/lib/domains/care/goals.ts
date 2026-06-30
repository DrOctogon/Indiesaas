"use server"

import { revalidatePath } from "next/cache"
import {
    type CareGoal,
    type CareGoalInput,
    careGoalInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Care-goals domain operations — clones the canonical daily-log pattern: guard
 * FIRST, construct the Repository from the auth context, validate untrusted
 * input with Zod at the boundary, return a typed ActionResult envelope. View is
 * open to caregiver+family; writes remain in the `care` area.
 */

const COLLECTION = "careGoals" as const

/** List all care goals in the active workspace (view-gated). */
export async function listCareGoals(): Promise<ActionResult<CareGoal[]>> {
    try {
        const ctx = await requireAccess("goals")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<CareGoal>(COLLECTION))
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a care goal (write-gated to the `care` area). */
export async function createCareGoal(
    input: unknown
): Promise<ActionResult<CareGoal>> {
    try {
        const ctx = await requireWrite("goals", "care")
        const parsed = careGoalInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<CareGoalInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/care/goals")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing care goal (write-gated). */
export async function updateCareGoal(
    id: string,
    patch: unknown
): Promise<ActionResult<CareGoal>> {
    try {
        const ctx = await requireWrite("goals", "care")
        const parsed = careGoalInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<CareGoal>(COLLECTION, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Care goal not found." }
        }
        revalidatePath("/care/goals")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a care goal (write-gated). */
export async function deleteCareGoal(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("goals", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Care goal not found." }
        }
        revalidatePath("/care/goals")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
