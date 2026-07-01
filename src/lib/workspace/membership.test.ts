import { describe, expect, it } from "vitest"
import {
    LastAdminError,
    type MemberLike,
    SeatCapError,
    assertNotLastAdminRemoval,
    assertRoleChangeAllowed,
    assertSeatAvailable,
    countActiveAdmins,
    isLastActiveAdmin,
    seatsInUse
} from "./membership"

/**
 * Pure membership-lifecycle rules (BUILD/04 §member management). These decide
 * *whether* an action is allowed given the current member set; the DB-bound
 * hooks in `./lifecycle` load the members and defer to these. The seat-cap
 * branch here is the enforcement decision the live fail-open lookup could not
 * exercise (no active Stripe subscription in the local env) — a non-null cap is
 * enforced deterministically without touching billing.
 */

const admin = (userId: string, suspended = false): MemberLike => ({
    userId,
    role: "admin",
    suspended
})
const caregiver = (userId: string): MemberLike => ({
    userId,
    role: "caregiver"
})

describe("countActiveAdmins", () => {
    it("counts only non-suspended admins", () => {
        const members = [
            admin("a1"),
            admin("a2", true), // suspended — excluded
            caregiver("c1")
        ]
        expect(countActiveAdmins(members)).toBe(1)
    })
})

describe("isLastActiveAdmin", () => {
    it("is true when the target is the sole active admin", () => {
        expect(isLastActiveAdmin([admin("a1"), caregiver("c1")], "a1")).toBe(
            true
        )
    })

    it("is false when another active admin remains", () => {
        expect(isLastActiveAdmin([admin("a1"), admin("a2")], "a1")).toBe(false)
    })

    it("is false for a non-admin target", () => {
        expect(isLastActiveAdmin([admin("a1"), caregiver("c1")], "c1")).toBe(
            false
        )
    })

    it("ignores a suspended second admin (still last active)", () => {
        expect(isLastActiveAdmin([admin("a1"), admin("a2", true)], "a1")).toBe(
            true
        )
    })
})

describe("assertNotLastAdminRemoval", () => {
    it("throws LastAdminError removing the sole admin", () => {
        expect(() =>
            assertNotLastAdminRemoval([admin("a1"), caregiver("c1")], "a1")
        ).toThrow(LastAdminError)
    })

    it("allows removing an admin when a second active admin remains", () => {
        expect(() =>
            assertNotLastAdminRemoval([admin("a1"), admin("a2")], "a1")
        ).not.toThrow()
    })

    it("allows removing a non-admin member", () => {
        expect(() =>
            assertNotLastAdminRemoval([admin("a1"), caregiver("c1")], "c1")
        ).not.toThrow()
    })
})

describe("assertRoleChangeAllowed", () => {
    it("throws demoting the sole admin to a non-admin role", () => {
        expect(() =>
            assertRoleChangeAllowed(
                [admin("a1"), caregiver("c1")],
                "a1",
                "family"
            )
        ).toThrow(LastAdminError)
    })

    it("allows keeping the sole admin as admin (no-op role set)", () => {
        expect(() =>
            assertRoleChangeAllowed([admin("a1")], "a1", "admin")
        ).not.toThrow()
    })

    it("allows demoting one admin when another remains", () => {
        expect(() =>
            assertRoleChangeAllowed(
                [admin("a1"), admin("a2")],
                "a1",
                "caregiver"
            )
        ).not.toThrow()
    })
})

describe("seatsInUse", () => {
    it("sums active members and pending invitations", () => {
        expect(seatsInUse(4, 2)).toBe(6)
    })
})

describe("assertSeatAvailable", () => {
    it("allows an invite below the cap", () => {
        expect(() => assertSeatAvailable(2, 3)).not.toThrow()
    })

    it("throws SeatCapError when consumed seats equal the cap", () => {
        // 3 seats used against a cap of 3 — one more would exceed it.
        expect(() => assertSeatAvailable(3, 3)).toThrow(SeatCapError)
    })

    it("throws SeatCapError when already over the cap", () => {
        expect(() => assertSeatAvailable(5, 3)).toThrow(SeatCapError)
    })

    it("names the cap in the error message", () => {
        expect(() => assertSeatAvailable(10, 10)).toThrow(/10/)
    })

    it("treats a null cap as unlimited (fail-open)", () => {
        expect(() => assertSeatAvailable(9999, null)).not.toThrow()
    })
})
