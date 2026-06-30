import { eq } from "drizzle-orm"
import { db } from "@/database/db"
import { organizations } from "@/database/schema"

/**
 * Per-workspace IANA timezone accessor (see BUILD/03 §workspaces). The zone is
 * stored inside `organizations.metadata` — a `text` column holding a Better Auth
 * stringified-JSON blob — under a `timezone` key. Overdue and digest math is
 * always evaluated workspace-local (never server UTC), so every read falls back
 * to a sane default rather than letting a missing/invalid zone leak UTC into the
 * result.
 */

/** Fallback zone when a workspace has not set one. */
export const DEFAULT_TIMEZONE = "America/Los_Angeles"

/** The slice of `organizations.metadata` JSON we read. */
interface WorkspaceMetadata {
    timezone?: string
}

/** Whether `tz` resolves as an IANA timezone (validated via Intl — no dep). */
function isValidTimezone(tz: string): boolean {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz })
        return true
    } catch {
        return false
    }
}

/**
 * Resolve the workspace's IANA timezone from `organizations.metadata`. Returns
 * `DEFAULT_TIMEZONE` when the workspace is unknown, carries no metadata, stores
 * no `timezone`, or stores an unresolvable one. NEVER throws — a malformed
 * metadata blob degrades to the default instead of breaking the caller.
 */
export async function getWorkspaceTimezone(
    workspaceId: string
): Promise<string> {
    try {
        const rows = await db
            .select({ metadata: organizations.metadata })
            .from(organizations)
            .where(eq(organizations.id, workspaceId))
            .limit(1)

        const raw = rows[0]?.metadata
        if (!raw) return DEFAULT_TIMEZONE

        const parsed = JSON.parse(raw) as WorkspaceMetadata
        const tz = parsed?.timezone
        if (typeof tz === "string" && isValidTimezone(tz)) return tz
        return DEFAULT_TIMEZONE
    } catch (error) {
        console.error("[workspace/timezone] read failed", workspaceId, error)
        return DEFAULT_TIMEZONE
    }
}
