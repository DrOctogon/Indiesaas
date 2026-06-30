"use server"

import { revalidatePath } from "next/cache"
import {
    type BudgetLine,
    type BudgetLineInput,
    budgetLineInput
} from "@/lib/domains/ops/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireManage } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Budget-line domain operations — ADMIN-ONLY (see BUILD/02 §Budget, BUILD/04 —
 * budget is admin-only view + write). Guard-first, fail-closed.
 *
 * View uses `requireAccess("budget")`, which already fails closed for non-admins
 * (roleAccess["budget"] = [] → only admin passes `can`). Writes additionally
 * pin to `requireManage("budget", ["admin"])`.
 */

const COLLECTION = "budgetLines" as const
const ADMIN_ONLY = ["admin"] as const

/** List all budget lines in the active workspace (admin-only view). */
export async function listBudgetLines(): Promise<ActionResult<BudgetLine[]>> {
    try {
        const ctx = await requireAccess("budget")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const lines = await repo.list<BudgetLine>(COLLECTION)
        return ok(lines)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a budget line (admin only). */
export async function createBudgetLine(
    input: unknown
): Promise<ActionResult<BudgetLine>> {
    try {
        const ctx = await requireManage("budget", ADMIN_ONLY)
        const parsed = budgetLineInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const line = await repo.create<BudgetLineInput>(COLLECTION, parsed.data)
        revalidatePath("/ops/budget")
        return ok(line)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update a budget line (admin only). */
export async function updateBudgetLine(
    id: string,
    patch: unknown
): Promise<ActionResult<BudgetLine>> {
    try {
        const ctx = await requireManage("budget", ADMIN_ONLY)
        const parsed = budgetLineInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<BudgetLine>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Budget line not found." }
        }
        revalidatePath("/ops/budget")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a budget line (admin only). */
export async function deleteBudgetLine(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireManage("budget", ADMIN_ONLY)
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Budget line not found." }
        }
        revalidatePath("/ops/budget")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
