"use server"

import { revalidatePath } from "next/cache"
import {
    type GuestStay,
    type GuestStayInput,
    type Tenant,
    type TenantInput,
    guestStayInput,
    tenantInput
} from "@/lib/domains/household/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireManage } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Tenant + guest-stay domain operations — ADMIN-ONLY. Cloned from the canonical
 * care/daily-log pattern, but every WRITE is gated by `requireManage("tenants",
 * ["admin"])` (the explicit role set) rather than `requireWrite`, because the
 * tenant ledger is admin-only (see BUILD/04 + the RBAC view matrix, where
 * `tenants` maps to `[]` = admin-only). Reads use `requireAccess("tenants")`,
 * which already resolves to admin-only. Guard FIRST → Repository from context →
 * Zod at the boundary → typed `ActionResult`, never throwing across the boundary.
 */

const TENANTS = "tenants" as const
const GUEST_STAYS = "guestStays" as const
const MANAGE_ROLES = ["admin"] as const

// --- tenants ---

/** List all tenants in the active workspace (admin-only view). */
export async function listTenants(): Promise<ActionResult<Tenant[]>> {
    try {
        const ctx = await requireAccess("tenants")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const tenants = await repo.list<Tenant>(TENANTS)
        return ok(tenants)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a tenant (admin-only write via requireManage). */
export async function createTenant(
    input: unknown
): Promise<ActionResult<Tenant>> {
    try {
        const ctx = await requireManage("tenants", MANAGE_ROLES)
        const parsed = tenantInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const tenant = await repo.create<TenantInput>(TENANTS, parsed.data)
        revalidatePath("/household/tenants")
        return ok(tenant)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update a tenant (admin-only write). Null id-miss → failure envelope. */
export async function updateTenant(
    id: string,
    patch: unknown
): Promise<ActionResult<Tenant>> {
    try {
        const ctx = await requireManage("tenants", MANAGE_ROLES)
        const parsed = tenantInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Tenant>(TENANTS, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Tenant not found." }
        }
        revalidatePath("/household/tenants")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a tenant (admin-only write). */
export async function deleteTenant(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireManage("tenants", MANAGE_ROLES)
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(TENANTS, id)
        if (!removed) {
            return { status: false, message: "Tenant not found." }
        }
        revalidatePath("/household/tenants")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}

// --- guest stays ---

/** List all guest stays in the active workspace (admin-only view). */
export async function listGuestStays(): Promise<ActionResult<GuestStay[]>> {
    try {
        const ctx = await requireAccess("tenants")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const stays = await repo.list<GuestStay>(GUEST_STAYS)
        return ok(stays)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a guest stay (admin-only write via requireManage). */
export async function createGuestStay(
    input: unknown
): Promise<ActionResult<GuestStay>> {
    try {
        const ctx = await requireManage("tenants", MANAGE_ROLES)
        const parsed = guestStayInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const stay = await repo.create<GuestStayInput>(GUEST_STAYS, parsed.data)
        revalidatePath("/household/tenants")
        return ok(stay)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update a guest stay (admin-only write). Null id-miss → failure envelope. */
export async function updateGuestStay(
    id: string,
    patch: unknown
): Promise<ActionResult<GuestStay>> {
    try {
        const ctx = await requireManage("tenants", MANAGE_ROLES)
        const parsed = guestStayInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<GuestStay>(
            GUEST_STAYS,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Guest stay not found." }
        }
        revalidatePath("/household/tenants")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a guest stay (admin-only write). */
export async function deleteGuestStay(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireManage("tenants", MANAGE_ROLES)
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(GUEST_STAYS, id)
        if (!removed) {
            return { status: false, message: "Guest stay not found." }
        }
        revalidatePath("/household/tenants")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
