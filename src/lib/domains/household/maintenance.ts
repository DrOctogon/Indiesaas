"use server"

import { revalidatePath } from "next/cache"
import {
    type MaintenanceTask,
    type MaintenanceTaskInput,
    maintenanceTaskInput
} from "@/lib/domains/household/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Maintenance-task domain operations — cloned from the canonical
 * care/daily-log pattern (guard FIRST → Repository from context → Zod at the
 * boundary → typed `ActionResult`, never throwing across the boundary).
 * View-gated by navKey "maintenance"; writes gated to the "household" area.
 */

const COLLECTION = "maintenanceTasks" as const

/** List all maintenance tasks in the active workspace (view-gated). */
export async function listMaintenanceTasks(): Promise<
    ActionResult<MaintenanceTask[]>
> {
    try {
        const ctx = await requireAccess("maintenance")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const tasks = await repo.list<MaintenanceTask>(COLLECTION)
        return ok(tasks)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a maintenance task (write-gated to the `household` area). */
export async function createMaintenanceTask(
    input: unknown
): Promise<ActionResult<MaintenanceTask>> {
    try {
        const ctx = await requireWrite("maintenance", "household")
        const parsed = maintenanceTaskInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const task = await repo.create<MaintenanceTaskInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/household/maintenance")
        return ok(task)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing maintenance task (write-gated). Null id-miss → failure. */
export async function updateMaintenanceTask(
    id: string,
    patch: unknown
): Promise<ActionResult<MaintenanceTask>> {
    try {
        const ctx = await requireWrite("maintenance", "household")
        const parsed = maintenanceTaskInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<MaintenanceTask>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Maintenance task not found." }
        }
        revalidatePath("/household/maintenance")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a maintenance task (write-gated). */
export async function deleteMaintenanceTask(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("maintenance", "household")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Maintenance task not found." }
        }
        revalidatePath("/household/maintenance")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
