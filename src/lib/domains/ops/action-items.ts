"use server"

import { revalidatePath } from "next/cache"
import {
    type ActionItem,
    type ActionItemInput,
    actionItemInput
} from "@/lib/domains/ops/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import type { RoleId } from "@/lib/rbac/access"
import { requireAccess, requireManage } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Action-item domain operations (see BUILD/02 §Action Items, BUILD/04 §row-level
 * filters). Guard-first, fail-closed, returns the `ActionResult` envelope.
 *
 * WRITE-AREA CHOICE (documented per task instruction — ambiguous): action items
 * are an explicitly *cross-cutting* tracker (BUILD/02 line 137) and BUILD/04's
 * `WriteArea` union (care|household|events|admin|alertAck) has no single area
 * that maps cleanly. The catalog lists no dedicated Write role-set either. So
 * writes use `requireManage("action-items", [all four roles])` — every role that
 * can view the nav may write — and row visibility is enforced by tag-filtering on
 * read (below), which is the actual access-control mechanism the spec specifies.
 */

const COLLECTION = "actionItems" as const
const WRITE_ROLES = ["admin", "caregiver", "family", "household"] as const

/**
 * Tag → roles that may see the row (BUILD/04 line 118). `admin` sees all;
 * unknown / missing tag is hidden for non-admins (fail closed).
 */
const TAG_VISIBILITY: Record<string, RoleId[]> = {
    care: ["caregiver"],
    household: ["household"],
    family: ["family"],
    admin: [],
    finance: []
}

function visibleToRole(item: ActionItem, role: RoleId): boolean {
    if (role === "admin") return true
    if (!item.tag) return false
    const roles = TAG_VISIBILITY[item.tag]
    if (!roles) return false
    return roles.includes(role)
}

/** List action items, tag-filtered to the caller's role (view-gated). */
export async function listActionItems(): Promise<ActionResult<ActionItem[]>> {
    try {
        const ctx = await requireAccess("action-items")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const items = await repo.list<ActionItem>(COLLECTION)
        const visible = items.filter((item) => visibleToRole(item, ctx.role))
        return ok(visible)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create an action item. */
export async function createActionItem(
    input: unknown
): Promise<ActionResult<ActionItem>> {
    try {
        const ctx = await requireManage("action-items", WRITE_ROLES)
        const parsed = actionItemInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const item = await repo.create<ActionItemInput>(COLLECTION, parsed.data)
        revalidatePath("/ops/action-items")
        return ok(item)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an action item. */
export async function updateActionItem(
    id: string,
    patch: unknown
): Promise<ActionResult<ActionItem>> {
    try {
        const ctx = await requireManage("action-items", WRITE_ROLES)
        const parsed = actionItemInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<ActionItem>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Action item not found." }
        }
        revalidatePath("/ops/action-items")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete an action item. */
export async function deleteActionItem(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireManage("action-items", WRITE_ROLES)
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Action item not found." }
        }
        revalidatePath("/ops/action-items")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
