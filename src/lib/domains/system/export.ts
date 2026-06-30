"use server"

import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import {
    type CollectionName,
    accountPreferences,
    collections,
    notificationSubscriptions
} from "@/database/collections"
import { db } from "@/database/db"
import { members } from "@/database/schema"
import { auth } from "@/lib/auth"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireManage, requireWorkspace } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * GDPR-style data export (System area; see BUILD/06 §Data lifecycle, invariant
 * 13). Two flavours:
 *
 *  - `exportWorkspaceData()` — admin-only per-workspace dump. Iterates EVERY
 *    workspace-scoped collection through the generic Repository, so the result
 *    is auto-scoped to the active workspace by construction — there is no path
 *    to cross-tenant data here. Returns `{ [collection]: rows[] }`.
 *  - `exportMyAccountData()` — any authenticated user's *user-global* rows
 *    (accountPreferences, notificationSubscriptions, keyed by `user_id`, not
 *    workspace) plus their workspace memberships.
 *
 * Both guard FIRST and never throw across the server boundary — they map any
 * error to a typed `ActionResult` failure. The export is read-only (no audit
 * row): it copies data out, it does not mutate.
 */

/** A per-workspace dump: every collection name mapped to its rows. */
export type WorkspaceExport = Record<CollectionName, unknown[]>

/** A single membership row in a user's account export. */
export interface AccountMembership {
    organizationId: string
    role: string
    createdAt: Date
}

/** A user's portable account data (user-global rows + memberships). */
export interface AccountExport {
    userId: string
    accountPreferences: unknown[]
    notificationSubscriptions: unknown[]
    memberships: AccountMembership[]
}

/** Every workspace-scoped collection name, derived from the registry. */
const COLLECTION_NAMES = Object.keys(collections) as CollectionName[]

/**
 * Admin-only per-workspace export. Assembles a single JSON object keyed by
 * collection name, each value the full row list for the active workspace. Reads
 * go exclusively through the Repository, which auto-scopes every query by
 * `workspace_id`, so the dump can never leak another tenant's data.
 */
export async function exportWorkspaceData(): Promise<
    ActionResult<WorkspaceExport>
> {
    try {
        const ctx = await requireManage("workspace", ["admin"])
        const repo = new Repository(ctx.userId, ctx.workspaceId)

        const entries = await Promise.all(
            COLLECTION_NAMES.map(
                async (name) => [name, await repo.list(name)] as const
            )
        )

        const dump = Object.fromEntries(entries) as WorkspaceExport
        return ok(dump)
    } catch (error) {
        return failFrom(error)
    }
}

/**
 * Per-user account export. Available to any authenticated workspace member.
 * Returns the signed-in user's user-global collection rows plus their
 * memberships. User-global tables are keyed by `user_id` (an explicit exception
 * to the workspace-scoping rule), so they are read through `db` filtered to the
 * actor's own `userId` — a user only ever exports their own rows.
 */
export async function exportMyAccountData(): Promise<
    ActionResult<AccountExport>
> {
    try {
        const ctx = await requireWorkspace()

        const [prefs, subs, memberRows] = await Promise.all([
            db
                .select({ data: accountPreferences.data })
                .from(accountPreferences)
                .where(eq(accountPreferences.userId, ctx.userId)),
            db
                .select({ data: notificationSubscriptions.data })
                .from(notificationSubscriptions)
                .where(eq(notificationSubscriptions.userId, ctx.userId)),
            db
                .select({
                    organizationId: members.organizationId,
                    role: members.role,
                    createdAt: members.createdAt
                })
                .from(members)
                .where(eq(members.userId, ctx.userId))
        ])

        return ok({
            userId: ctx.userId,
            accountPreferences: prefs.map((r) => r.data),
            notificationSubscriptions: subs.map((r) => r.data),
            memberships: memberRows
        })
    } catch (error) {
        return failFrom(error)
    }
}

/**
 * A short, filesystem-safe label for the active workspace, used by the download
 * Route Handler to name the export attachment (e.g. `acme-export-2026-06-30.json`).
 * Admin-guarded; falls back to a generic name if the workspace can't be read.
 */
export async function workspaceExportFilename(): Promise<string> {
    try {
        await requireManage("workspace", ["admin"])
        const org = await auth.api.getFullOrganization({
            headers: await headers()
        })
        const slug = org?.slug ?? org?.id ?? "workspace"
        const date = new Date().toISOString().slice(0, 10)
        return `${slug}-export-${date}.json`
    } catch {
        return "workspace-export.json"
    }
}
