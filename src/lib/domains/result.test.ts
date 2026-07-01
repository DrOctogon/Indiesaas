import { afterEach, describe, expect, it, vi } from "vitest"
import { ForbiddenError, UnauthorizedError } from "@/lib/rbac/errors"
import { fail, failFrom, ok } from "./result"

/**
 * The action-result envelope is the server/client boundary for every domain op.
 * The security-relevant invariant lives in `failFrom`: only auth/permission
 * errors surface their own message; every other thrown error is logged
 * server-side and returned as a generic message so internal detail (stack
 * traces, DB errors, secrets in messages) never leaks to the client.
 */

afterEach(() => {
    vi.restoreAllMocks()
})

describe("ok / fail", () => {
    it("ok wraps data with status true and no message", () => {
        expect(ok({ id: "vi-1" })).toEqual({
            status: true,
            data: { id: "vi-1" }
        })
    })

    it("fail carries the message with status false and no data", () => {
        expect(fail("nope")).toEqual({ status: false, message: "nope" })
    })
})

describe("failFrom", () => {
    it("passes through an UnauthorizedError message", () => {
        const r = failFrom(new UnauthorizedError())
        expect(r.status).toBe(false)
        expect(r.message).toBe("Authentication required")
    })

    it("passes through a ForbiddenError message", () => {
        const r = failFrom(new ForbiddenError("No view access to 'budget'"))
        expect(r.message).toBe("No view access to 'budget'")
    })

    it("returns a generic message for an unexpected error (no leak)", () => {
        vi.spyOn(console, "error").mockImplementation(() => {})
        const leaky = new Error("DB connection string postgres://secret@host")
        const r = failFrom(leaky)
        expect(r).toEqual({ status: false, message: "Something went wrong." })
        expect(r.message).not.toContain("secret")
    })

    it("logs the unexpected error server-side", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {})
        failFrom(new Error("boom"))
        expect(spy).toHaveBeenCalledOnce()
    })

    it("does not leak a non-Error thrown value", () => {
        vi.spyOn(console, "error").mockImplementation(() => {})
        const r = failFrom("raw string with token sk_live_abc")
        expect(r.message).toBe("Something went wrong.")
    })
})
