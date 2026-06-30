"use server"

import { revalidatePath } from "next/cache"
import {
    type InventoryItem,
    type InventoryItemInput,
    inventoryItemInput
} from "@/lib/domains/household/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Inventory domain operations — cloned from the canonical care/daily-log
 * pattern (guard FIRST → Repository from context → Zod at the boundary → typed
 * `ActionResult`, never throwing across the boundary). View-gated by navKey
 * "inventory"; writes gated to the "household" area.
 */

const COLLECTION = "inventory" as const

/** List all inventory items in the active workspace (view-gated). */
export async function listInventory(): Promise<ActionResult<InventoryItem[]>> {
    try {
        const ctx = await requireAccess("inventory")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const items = await repo.list<InventoryItem>(COLLECTION)
        return ok(items)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create an inventory item (write-gated to the `household` area). */
export async function createInventoryItem(
    input: unknown
): Promise<ActionResult<InventoryItem>> {
    try {
        const ctx = await requireWrite("inventory", "household")
        const parsed = inventoryItemInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const item = await repo.create<InventoryItemInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/household/inventory")
        return ok(item)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing inventory item (write-gated). Null id-miss → failure. */
export async function updateInventoryItem(
    id: string,
    patch: unknown
): Promise<ActionResult<InventoryItem>> {
    try {
        const ctx = await requireWrite("inventory", "household")
        const parsed = inventoryItemInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<InventoryItem>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Inventory item not found." }
        }
        revalidatePath("/household/inventory")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete an inventory item (write-gated). */
export async function deleteInventoryItem(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("inventory", "household")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Inventory item not found." }
        }
        revalidatePath("/household/inventory")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
