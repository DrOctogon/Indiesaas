"use server"

import { revalidatePath } from "next/cache"
import {
    type CareTask,
    type CareTaskCompletion,
    type CareTaskCompletionInput,
    type CareTaskInput,
    careTaskCompletionInput,
    careTaskInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { findOverdueTasks } from "@/lib/engine/tasks"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Care-task domain operations — clones the canonical daily-log pattern: guard
 * FIRST, construct the Repository from the auth context, validate untrusted
 * input with Zod at the boundary, return a typed ActionResult envelope.
 *
 * The overdue view wires the pure `findOverdueTasks` engine, injecting `now`
 * and the workspace timezone (the engine never reads an ambient clock — time is
 * always injected so the result is deterministic and workspace-local).
 */

const COLLECTION = "careTasks" as const
const COMPLETIONS = "careTaskCompletions" as const

/**
 * The workspace IANA timezone. The workspace record carries this in its
 * settings (see BUILD/03 §workspaces); until that accessor is wired we default
 * to a single zone so overdue math stays workspace-local rather than UTC.
 */
const DEFAULT_TIMEZONE = "America/Los_Angeles"

/** List all care tasks in the active workspace (view-gated). */
export async function listCareTasks(): Promise<ActionResult<CareTask[]>> {
    try {
        const ctx = await requireAccess("tasks")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<CareTask>(COLLECTION))
    } catch (error) {
        return failFrom(error)
    }
}

/**
 * Overdue care tasks in the active workspace, evaluated in workspace-local time
 * via the pure overdue engine (now + timezone injected).
 */
export async function listOverdueCareTasks(): Promise<
    ActionResult<CareTask[]>
> {
    try {
        const ctx = await requireAccess("tasks")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const tasks = await repo.list<CareTask>(COLLECTION)
        const overdue = findOverdueTasks(tasks, new Date(), DEFAULT_TIMEZONE)
        return ok(overdue)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a care task (write-gated to the `care` area). */
export async function createCareTask(
    input: unknown
): Promise<ActionResult<CareTask>> {
    try {
        const ctx = await requireWrite("tasks", "care")
        const parsed = careTaskInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<CareTaskInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/care/tasks")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing care task (write-gated). */
export async function updateCareTask(
    id: string,
    patch: unknown
): Promise<ActionResult<CareTask>> {
    try {
        const ctx = await requireWrite("tasks", "care")
        const parsed = careTaskInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<CareTask>(COLLECTION, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Care task not found." }
        }
        revalidatePath("/care/tasks")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a care task (write-gated). */
export async function deleteCareTask(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("tasks", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Care task not found." }
        }
        revalidatePath("/care/tasks")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}

/** List all care-task completions in the active workspace (view-gated). */
export async function listCareTaskCompletions(): Promise<
    ActionResult<CareTaskCompletion[]>
> {
    try {
        const ctx = await requireAccess("tasks")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<CareTaskCompletion>(COMPLETIONS))
    } catch (error) {
        return failFrom(error)
    }
}

/** Record a care-task completion (write-gated to the `care` area). */
export async function createCareTaskCompletion(
    input: unknown
): Promise<ActionResult<CareTaskCompletion>> {
    try {
        const ctx = await requireWrite("tasks", "care")
        const parsed = careTaskCompletionInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<CareTaskCompletionInput>(
            COMPLETIONS,
            parsed.data
        )
        revalidatePath("/care/tasks")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}
