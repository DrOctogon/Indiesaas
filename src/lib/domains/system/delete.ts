"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { type CollectionName, collections } from "@/database/collections"
import { auth } from "@/lib/auth"
import { type ActionResult, fail, failFrom, ok } from "@/lib/domains/result"
import { requireManage } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * DESTRUCTIVE per-workspace data delete (System area; see BUILD/06 §Data
 * lifecycle, invariant 13). This permanently removes every domain row in the
 * active workspace — recipients, vitals, meds, logs, tasks, documents, the lot.
 *
 * IRREVERSIBLE. There is no soft-delete and no undo: once committed the rows are
 * gone. To make accidental invocation impossible, the caller MUST pass a
 * confirmation string that exactly matches the workspace name; a mismatch is
 * refused before anything is touched. This is never a one-click action.
 *
 * SCOPE: domain *collection data* only. It deliberately does NOT delete the
 * organization row itself, its members, or invitations — workspace teardown
 * (delete-workspace, last-admin-guarded) is a separate lifecycle op. Deleting
 * the org row would FK-cascade these tables anyway; this op is the "empty the
 * workspace but keep it" path.
 *
 * Every row removed is audited by the Repository (a delete audit row per row,
 * before/after), so the erasure is itself traceable.
 */

const DATA_PATH = "/admin/data"

/** Confirmation payload: the typed workspace name that must match exactly. */
export const deleteWorkspaceDataInput = z
    .object({
        confirmation: z.string().min(1, "Type the workspace name to confirm.")
    })
    .strict()

export type DeleteWorkspaceDataInput = z.infer<typeof deleteWorkspaceDataInput>

/** All workspace-scoped collection names, derived from the registry. */
const COLLECTION_NAMES = Object.keys(collections) as CollectionName[]

/** Summary of a destructive delete: rows removed per collection + the total. */
export interface DeleteWorkspaceDataResult {
    deletedByCollection: Record<string, number>
    totalDeleted: number
}

/**
 * Permanently delete all domain data in the active workspace (admin-only).
 *
 * Guards FIRST with `requireManage("workspace", ["admin"])`, then requires the
 * `confirmation` string to exactly equal the workspace name before removing a
 * single row. Iterates every collection and removes its rows through the
 * Repository (each delete is workspace-scoped and audited). Returns a per-
 * collection deletion count. Never throws across the boundary.
 */
export async function deleteWorkspaceData(
    input: unknown
): Promise<ActionResult<DeleteWorkspaceDataResult>> {
    try {
        const ctx = await requireManage("workspace", ["admin"])

        const parsed = deleteWorkspaceDataInput.safeParse(input)
        if (!parsed.success) {
            return fail(
                parsed.error.issues[0]?.message ?? "Confirmation required."
            )
        }

        const org = await auth.api.getFullOrganization({
            headers: await headers()
        })
        if (!org) {
            return fail("No active workspace.")
        }
        if (parsed.data.confirmation.trim() !== org.name) {
            return fail(
                "Confirmation does not match the workspace name. Nothing was deleted."
            )
        }

        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const deletedByCollection: Record<string, number> = {}
        let totalDeleted = 0

        // Remove each collection's rows id-by-id through the Repository so every
        // delete stays workspace-scoped and is individually audited. Cascades
        // (e.g. recipient -> vitals) are handled inside Repository.remove; rows
        // already swept by a parent cascade simply return false and are skipped.
        for (const name of COLLECTION_NAMES) {
            const rows = await repo.list<{ id: string }>(name)
            let removed = 0
            for (const row of rows) {
                const didRemove = await repo.remove(name, row.id)
                if (didRemove) {
                    removed += 1
                }
            }
            if (removed > 0) {
                deletedByCollection[name] = removed
                totalDeleted += removed
            }
        }

        revalidatePath(DATA_PATH)
        return ok({ deletedByCollection, totalDeleted })
    } catch (error) {
        return failFrom(error)
    }
}
