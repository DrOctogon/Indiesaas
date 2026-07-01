import { randomUUID } from "node:crypto"
import { auditLog } from "@/database/collections"
import { db } from "@/database/db"

/**
 * Auth-event auditing (BUILD/06 invariant 2 — "login + login-failed are audited
 * too"). Unlike domain mutations, auth events are not workspace-scoped: a login
 * carries no active workspace yet and a failed login for an unknown email has no
 * actor, so both `workspaceId` and `actorUserId` are nullable on `audit_log`.
 *
 * Both writers NEVER throw — an audit failure must not break authentication.
 * They are wired from the Better Auth hooks in `@/lib/auth`.
 */

const AUTH = "auth" as const

/** Record a successful login. `workspaceId` is the active workspace if resolved. */
export async function recordLogin(
    userId: string,
    workspaceId: string | null,
    ip: string | null
): Promise<void> {
    try {
        await db.insert(auditLog).values({
            id: randomUUID(),
            workspaceId,
            actorUserId: userId,
            action: "login",
            collection: AUTH,
            entityId: userId,
            ip
        })
    } catch (error) {
        console.error("[audit] recordLogin failed", error)
    }
}

/** Record a failed login attempt. The attempted email (if any) is kept in `after`. */
export async function recordLoginFailed(
    email: string | null,
    ip: string | null
): Promise<void> {
    try {
        await db.insert(auditLog).values({
            id: randomUUID(),
            workspaceId: null,
            actorUserId: null,
            action: "login_failed",
            collection: AUTH,
            entityId: null,
            after: email ? { email } : null,
            ip
        })
    } catch (error) {
        console.error("[audit] recordLoginFailed failed", error)
    }
}
