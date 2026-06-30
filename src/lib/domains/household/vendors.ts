"use server"

import { revalidatePath } from "next/cache"
import {
    type Vendor,
    type VendorInput,
    vendorInput
} from "@/lib/domains/household/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Vendor domain operations — cloned from the canonical care/daily-log pattern
 * (guard FIRST → Repository from context → Zod at the boundary → typed
 * `ActionResult`, never throwing across the boundary). View-gated by navKey
 * "vendors"; writes gated to the "household" area.
 */

const COLLECTION = "vendors" as const

/** List all vendors in the active workspace (view-gated). */
export async function listVendors(): Promise<ActionResult<Vendor[]>> {
    try {
        const ctx = await requireAccess("vendors")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const vendors = await repo.list<Vendor>(COLLECTION)
        return ok(vendors)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a vendor (write-gated to the `household` area). */
export async function createVendor(
    input: unknown
): Promise<ActionResult<Vendor>> {
    try {
        const ctx = await requireWrite("vendors", "household")
        const parsed = vendorInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const vendor = await repo.create<VendorInput>(COLLECTION, parsed.data)
        revalidatePath("/household/vendors")
        return ok(vendor)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing vendor (write-gated). Null id-miss → failure envelope. */
export async function updateVendor(
    id: string,
    patch: unknown
): Promise<ActionResult<Vendor>> {
    try {
        const ctx = await requireWrite("vendors", "household")
        const parsed = vendorInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Vendor>(COLLECTION, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Vendor not found." }
        }
        revalidatePath("/household/vendors")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a vendor (write-gated). */
export async function deleteVendor(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("vendors", "household")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Vendor not found." }
        }
        revalidatePath("/household/vendors")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
