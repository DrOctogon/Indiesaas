"use server"

import { revalidatePath } from "next/cache"
import {
    type LandscapingTask,
    type LandscapingTaskInput,
    type LandscapingVendor,
    type LandscapingVendorInput,
    type LandscapingZone,
    type LandscapingZoneInput,
    landscapingTaskInput,
    landscapingVendorInput,
    landscapingZoneInput
} from "@/lib/domains/household/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Landscaping domain operations across three collections —
 * `landscapingZones`, `landscapingTasks`, `landscapingVendors` — cloned from
 * the canonical care/daily-log pattern (guard FIRST → Repository from context →
 * Zod at the boundary → typed `ActionResult`, never throwing across the
 * boundary). All view-gated by navKey "landscaping"; writes gated to the
 * "household" area.
 *
 * Deleting a zone cascades its tasks (matched on `zoneId`) — that cascade is
 * defined in the Repository (CASCADES.landscapingZones), not here.
 */

const ZONES = "landscapingZones" as const
const TASKS = "landscapingTasks" as const
const VENDORS = "landscapingVendors" as const

// --- zones ---

/** List all landscaping zones in the active workspace (view-gated). */
export async function listLandscapingZones(): Promise<
    ActionResult<LandscapingZone[]>
> {
    try {
        const ctx = await requireAccess("landscaping")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const zones = await repo.list<LandscapingZone>(ZONES)
        return ok(zones)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a landscaping zone (write-gated to the `household` area). */
export async function createLandscapingZone(
    input: unknown
): Promise<ActionResult<LandscapingZone>> {
    try {
        const ctx = await requireWrite("landscaping", "household")
        const parsed = landscapingZoneInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const zone = await repo.create<LandscapingZoneInput>(ZONES, parsed.data)
        revalidatePath("/household/landscaping")
        return ok(zone)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update a landscaping zone (write-gated). Null id-miss → failure envelope. */
export async function updateLandscapingZone(
    id: string,
    patch: unknown
): Promise<ActionResult<LandscapingZone>> {
    try {
        const ctx = await requireWrite("landscaping", "household")
        const parsed = landscapingZoneInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<LandscapingZone>(
            ZONES,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Landscaping zone not found." }
        }
        revalidatePath("/household/landscaping")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a landscaping zone (write-gated); cascades its tasks via the Repository. */
export async function deleteLandscapingZone(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("landscaping", "household")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(ZONES, id)
        if (!removed) {
            return { status: false, message: "Landscaping zone not found." }
        }
        revalidatePath("/household/landscaping")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}

// --- tasks ---

/** List all landscaping tasks in the active workspace (view-gated). */
export async function listLandscapingTasks(): Promise<
    ActionResult<LandscapingTask[]>
> {
    try {
        const ctx = await requireAccess("landscaping")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const tasks = await repo.list<LandscapingTask>(TASKS)
        return ok(tasks)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a landscaping task (write-gated to the `household` area). */
export async function createLandscapingTask(
    input: unknown
): Promise<ActionResult<LandscapingTask>> {
    try {
        const ctx = await requireWrite("landscaping", "household")
        const parsed = landscapingTaskInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const task = await repo.create<LandscapingTaskInput>(TASKS, parsed.data)
        revalidatePath("/household/landscaping")
        return ok(task)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update a landscaping task (write-gated). Null id-miss → failure envelope. */
export async function updateLandscapingTask(
    id: string,
    patch: unknown
): Promise<ActionResult<LandscapingTask>> {
    try {
        const ctx = await requireWrite("landscaping", "household")
        const parsed = landscapingTaskInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<LandscapingTask>(
            TASKS,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Landscaping task not found." }
        }
        revalidatePath("/household/landscaping")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a landscaping task (write-gated). */
export async function deleteLandscapingTask(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("landscaping", "household")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(TASKS, id)
        if (!removed) {
            return { status: false, message: "Landscaping task not found." }
        }
        revalidatePath("/household/landscaping")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}

// --- vendors ---

/** List all landscaping vendors in the active workspace (view-gated). */
export async function listLandscapingVendors(): Promise<
    ActionResult<LandscapingVendor[]>
> {
    try {
        const ctx = await requireAccess("landscaping")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const vendors = await repo.list<LandscapingVendor>(VENDORS)
        return ok(vendors)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a landscaping vendor (write-gated to the `household` area). */
export async function createLandscapingVendor(
    input: unknown
): Promise<ActionResult<LandscapingVendor>> {
    try {
        const ctx = await requireWrite("landscaping", "household")
        const parsed = landscapingVendorInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const vendor = await repo.create<LandscapingVendorInput>(
            VENDORS,
            parsed.data
        )
        revalidatePath("/household/landscaping")
        return ok(vendor)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update a landscaping vendor (write-gated). Null id-miss → failure envelope. */
export async function updateLandscapingVendor(
    id: string,
    patch: unknown
): Promise<ActionResult<LandscapingVendor>> {
    try {
        const ctx = await requireWrite("landscaping", "household")
        const parsed = landscapingVendorInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<LandscapingVendor>(
            VENDORS,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Landscaping vendor not found." }
        }
        revalidatePath("/household/landscaping")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a landscaping vendor (write-gated). */
export async function deleteLandscapingVendor(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("landscaping", "household")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(VENDORS, id)
        if (!removed) {
            return { status: false, message: "Landscaping vendor not found." }
        }
        revalidatePath("/household/landscaping")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
