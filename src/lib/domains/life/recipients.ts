"use server"

import { revalidatePath } from "next/cache"
import {
    type Recipient,
    type RecipientInput,
    recipientInput
} from "@/lib/domains/life/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Recipient domain operations — clones the canonical Care daily-log pattern.
 * Every op: (1) RBAC guard FIRST (fail-closed; derives `{userId, workspaceId}`),
 * (2) constructs the Repository from that context (tenant isolation by
 * construction), (3) validates untrusted input with Zod at the boundary,
 * (4) returns a typed `ActionResult` envelope and never throws across the
 * boundary.
 *
 * Recipients are the root care aggregate: deleting one cascades to its vitals,
 * medications, medLogs, visits, careGoals and careTasks (handled in the
 * Repository, always within the same workspace).
 */

const COLLECTION = "recipients" as const

/** List all recipients in the active workspace (view-gated). */
export async function listRecipients(): Promise<ActionResult<Recipient[]>> {
    try {
        const ctx = await requireAccess("recipients")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const recipients = await repo.list<Recipient>(COLLECTION)
        return ok(recipients)
    } catch (error) {
        return failFrom(error)
    }
}

/**
 * Fetch a single recipient by id (view-gated, workspace-scoped). A recipient
 * from another workspace is indistinguishable from a missing one (both → null).
 */
export async function getRecipient(
    id: string
): Promise<ActionResult<Recipient | null>> {
    try {
        const ctx = await requireAccess("recipients")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.get<Recipient>(COLLECTION, id))
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a recipient (write-gated to the `care` area). */
export async function createRecipient(
    input: unknown
): Promise<ActionResult<Recipient>> {
    try {
        const ctx = await requireWrite("recipients", "care")
        const parsed = recipientInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const recipient = await repo.create<RecipientInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/recipients")
        return ok(recipient)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing recipient (write-gated). Null id-miss → failure envelope. */
export async function updateRecipient(
    id: string,
    patch: unknown
): Promise<ActionResult<Recipient>> {
    try {
        const ctx = await requireWrite("recipients", "care")
        const parsed = recipientInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Recipient>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Recipient not found." }
        }
        revalidatePath("/recipients")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a recipient and cascade its care children (write-gated). */
export async function deleteRecipient(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("recipients", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Recipient not found." }
        }
        revalidatePath("/recipients")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
