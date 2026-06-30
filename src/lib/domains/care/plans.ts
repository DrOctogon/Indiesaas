"use server"

import { revalidatePath } from "next/cache"
import {
    type CareTaskProtocol,
    type CareTaskProtocolInput,
    careTaskProtocolInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Care-plan (care-task protocol) domain operations — clones the canonical
 * daily-log pattern: guard FIRST, construct the Repository from the auth
 * context, validate untrusted input with Zod at the boundary, return a typed
 * ActionResult envelope.
 */

const COLLECTION = "careTaskProtocols" as const

/** List all care plans in the active workspace (view-gated). */
export async function listCarePlans(): Promise<
    ActionResult<CareTaskProtocol[]>
> {
    try {
        const ctx = await requireAccess("plans")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<CareTaskProtocol>(COLLECTION))
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a care plan (write-gated to the `care` area). */
export async function createCarePlan(
    input: unknown
): Promise<ActionResult<CareTaskProtocol>> {
    try {
        const ctx = await requireWrite("plans", "care")
        const parsed = careTaskProtocolInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<CareTaskProtocolInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/care/plans")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing care plan (write-gated). */
export async function updateCarePlan(
    id: string,
    patch: unknown
): Promise<ActionResult<CareTaskProtocol>> {
    try {
        const ctx = await requireWrite("plans", "care")
        const parsed = careTaskProtocolInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<CareTaskProtocol>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Care plan not found." }
        }
        revalidatePath("/care/plans")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a care plan (write-gated). */
export async function deleteCarePlan(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("plans", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Care plan not found." }
        }
        revalidatePath("/care/plans")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
