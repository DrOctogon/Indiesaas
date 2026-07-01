import { describe, expect, it } from "vitest"
import { planSeatCap } from "./seats"

/**
 * `planSeatCap` maps a subscription plan *name* (as stored on the Stripe
 * subscription) to its configured seat cap. It is the pure half of seat-cap
 * enforcement — `getWorkspaceSeatCap` wraps it with the DB plan lookup and the
 * fail-open catch. Seat numbers mirror `src/lib/payments/plans.ts`
 * (basic 3, pro 10, Premium 50).
 */

describe("planSeatCap", () => {
    it("returns the configured cap for each plan", () => {
        expect(planSeatCap("basic")).toBe(3)
        expect(planSeatCap("pro")).toBe(10)
        expect(planSeatCap("Premium")).toBe(50)
    })

    it("matches the plan name case-insensitively", () => {
        expect(planSeatCap("BASIC")).toBe(3)
        expect(planSeatCap("premium")).toBe(50)
    })

    it("returns null for an unknown plan name", () => {
        expect(planSeatCap("enterprise-custom")).toBeNull()
    })
})
