"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { type ActionResult, fail, failFrom, ok } from "@/lib/domains/result"
import {
    type WorkspaceSettings,
    workspaceSettingsInput
} from "@/lib/domains/system/types"
import { auth } from "@/lib/auth"
import { requireManage } from "@/lib/rbac/guards"

/**
 * Workspace settings operations (System area, admin-only — navKey "workspace").
 *
 * A workspace is a Better Auth organization, so settings are read/written
 * through `auth.api.*` rather than the generic Repository. Name is a first-class
 * org column; timezone is a workspace-level preference carried in the org's
 * `metadata`. Each op guards FIRST with `requireManage("workspace", ["admin"])`
 * (fail-closed), validates input with Zod, and returns a typed `ActionResult`.
 */

const WORKSPACE_PATH = "/admin/workspace"

/** Read a string field from the org's loosely-typed metadata, if present. */
function readMetaString(
    metadata: Record<string, unknown> | null | undefined,
    key: string
): string | undefined {
    const value = metadata?.[key]
    return typeof value === "string" ? value : undefined
}

/** Read the active workspace's settings (admin-only). */
export async function getWorkspaceSettings(): Promise<
    ActionResult<WorkspaceSettings>
> {
    try {
        await requireManage("workspace", ["admin"])
        const org = await auth.api.getFullOrganization({
            headers: await headers()
        })
        if (!org) {
            return fail("No active workspace.")
        }
        return ok({
            id: org.id,
            name: org.name,
            slug: org.slug,
            timezone: readMetaString(
                org.metadata as Record<string, unknown> | null | undefined,
                "timezone"
            )
        })
    } catch (error) {
        return failFrom(error)
    }
}

/** Update the active workspace's name and timezone (admin-only). */
export async function updateWorkspaceSettings(
    input: unknown
): Promise<ActionResult<WorkspaceSettings>> {
    try {
        const ctx = await requireManage("workspace", ["admin"])
        const parsed = workspaceSettingsInput.safeParse(input)
        if (!parsed.success) {
            return fail(parsed.error.issues[0]?.message ?? "Invalid settings.")
        }

        const metadata: Record<string, unknown> = {}
        if (parsed.data.timezone) {
            metadata.timezone = parsed.data.timezone
        }

        const updated = await auth.api.updateOrganization({
            body: {
                organizationId: ctx.workspaceId,
                data: { name: parsed.data.name, metadata }
            },
            headers: await headers()
        })
        if (!updated) {
            return fail("Failed to update workspace settings.")
        }

        revalidatePath(WORKSPACE_PATH)
        return ok({
            id: updated.id,
            name: updated.name,
            slug: updated.slug,
            timezone: readMetaString(
                updated.metadata as Record<string, unknown> | null | undefined,
                "timezone"
            )
        })
    } catch (error) {
        return failFrom(error)
    }
}
