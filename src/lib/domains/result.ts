import { ForbiddenError, UnauthorizedError } from "@/lib/rbac/errors"

/**
 * Uniform server-action result envelope for every domain op (mirrors the
 * `{ status, message, data }` shape returned by `src/lib/payments/actions.ts`).
 * Domain actions never throw across the server/client boundary — they catch and
 * map to this envelope so the client always gets a typed, serialisable result.
 */
export interface ActionResult<T> {
    status: boolean
    message?: string
    data?: T
}

/** Success envelope. */
export function ok<T>(data: T): ActionResult<T> {
    return { status: true, data }
}

/** Failure envelope. */
export function fail<T = never>(message: string): ActionResult<T> {
    return { status: false, message }
}

/**
 * Map a thrown error to a failure envelope. Auth/permission errors surface
 * their own message; anything else is logged server-side and returned as a
 * generic message so internal detail never leaks to the client.
 */
export function failFrom<T = never>(error: unknown): ActionResult<T> {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        return { status: false, message: error.message }
    }
    console.error("[domain-action] unexpected error", error)
    return { status: false, message: "Something went wrong." }
}
