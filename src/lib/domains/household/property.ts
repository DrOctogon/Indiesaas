"use server"

import { revalidatePath } from "next/cache"
import {
    type Property,
    type PropertyInput,
    propertyInput
} from "@/lib/domains/household/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Property domain operations — cloned from the canonical care/daily-log pattern.
 * Every op guards FIRST (fail-closed; derives `{userId, workspaceId}`),
 * constructs the Repository from that context, validates input with Zod at the
 * boundary, and returns a typed `ActionResult` envelope, never throwing across
 * the boundary. View-gated by navKey "property"; writes gated to the
 * "household" write area.
 */

const COLLECTION = "properties" as const

/** List all properties in the active workspace (view-gated). */
export async function listProperties(): Promise<ActionResult<Property[]>> {
    try {
        const ctx = await requireAccess("property")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const properties = await repo.list<Property>(COLLECTION)
        return ok(properties)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a property (write-gated to the `household` area). */
export async function createProperty(
    input: unknown
): Promise<ActionResult<Property>> {
    try {
        const ctx = await requireWrite("property", "household")
        const parsed = propertyInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const property = await repo.create<PropertyInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/household/property")
        return ok(property)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing property (write-gated). Null id-miss → failure envelope. */
export async function updateProperty(
    id: string,
    patch: unknown
): Promise<ActionResult<Property>> {
    try {
        const ctx = await requireWrite("property", "household")
        const parsed = propertyInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Property>(COLLECTION, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Property not found." }
        }
        revalidatePath("/household/property")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a property (write-gated). */
export async function deleteProperty(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("property", "household")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Property not found." }
        }
        revalidatePath("/household/property")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
