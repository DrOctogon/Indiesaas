/**
 * Authorization error classes, in a dependency-free leaf module.
 *
 * These live apart from `./guards` on purpose: `guards.ts` imports `@/lib/auth`,
 * which constructs the Stripe client at module load. Consumers that only need to
 * pattern-match on the error type (e.g. the `failFrom` envelope in
 * `@/lib/domains/result`, imported by every domain action) must not drag the
 * auth/Stripe chain in transitively. `guards.ts` re-exports both for callers
 * that already import them from there.
 */

export class UnauthorizedError extends Error {
    constructor(message = "Authentication required") {
        super(message)
        this.name = "UnauthorizedError"
    }
}

export class ForbiddenError extends Error {
    constructor(message = "Forbidden") {
        super(message)
        this.name = "ForbiddenError"
    }
}
