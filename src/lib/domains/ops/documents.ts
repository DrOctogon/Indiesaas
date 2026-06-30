"use server"

import { revalidatePath } from "next/cache"
import {
    type AppDocument,
    type DocumentInput,
    documentInput
} from "@/lib/domains/ops/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireManage } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Document domain operations — ADMIN-ONLY (see BUILD/02 §Documents, BUILD/04 —
 * documents is admin-only view + write). Guard-first, fail-closed.
 *
 * View uses `requireAccess("documents")`, which already fails closed for
 * non-admins (roleAccess["documents"] = [] → only admin passes `can`). Writes
 * additionally pin to `requireManage("documents", ["admin"])`.
 */

const COLLECTION = "documents" as const
const ADMIN_ONLY = ["admin"] as const

/** List all documents in the active workspace (admin-only view). */
export async function listDocuments(): Promise<ActionResult<AppDocument[]>> {
    try {
        const ctx = await requireAccess("documents")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const docs = await repo.list<AppDocument>(COLLECTION)
        return ok(docs)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a document (admin only). */
export async function createDocument(
    input: unknown
): Promise<ActionResult<AppDocument>> {
    try {
        const ctx = await requireManage("documents", ADMIN_ONLY)
        const parsed = documentInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const doc = await repo.create<DocumentInput>(COLLECTION, parsed.data)
        revalidatePath("/ops/documents")
        return ok(doc)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update a document (admin only). */
export async function updateDocument(
    id: string,
    patch: unknown
): Promise<ActionResult<AppDocument>> {
    try {
        const ctx = await requireManage("documents", ADMIN_ONLY)
        const parsed = documentInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<AppDocument>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Document not found." }
        }
        revalidatePath("/ops/documents")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a document (admin only). */
export async function deleteDocument(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireManage("documents", ADMIN_ONLY)
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Document not found." }
        }
        revalidatePath("/ops/documents")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
