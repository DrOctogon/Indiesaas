import { describe, expect, it } from "vitest"
import type { RoleId } from "./access"
import {
    type NavKey,
    type WriteArea,
    can,
    canWrite,
    isAdminOnly
} from "./matrix"

/**
 * RBAC matrices are the authoritative feature-level gate (BUILD/04). Everything
 * fails closed: no role → deny, unmapped nav key → deny, unknown write area →
 * deny. `admin` is a workspace admin (passes view everywhere within its own
 * workspace) but write access is still granted per-area explicitly. These pure
 * checks are exercised in isolation here; the session-bound guards in
 * `./guards` layer auth + active-membership on top.
 */

const NON_ADMIN: RoleId[] = ["caregiver", "family", "household"]
const ADMIN_ONLY_KEYS: NavKey[] = [
    "budget",
    "documents",
    "tenants",
    "audit",
    "members",
    "workspace",
    "billing"
]

describe("can (view)", () => {
    it("denies a null/undefined role (fail closed)", () => {
        expect(can(null, "dashboard")).toBe(false)
        expect(can(undefined, "dashboard")).toBe(false)
    })

    it("admin passes every nav key, including admin-only", () => {
        for (const key of ADMIN_ONLY_KEYS) {
            expect(can("admin", key)).toBe(true)
        }
        expect(can("admin", "dashboard")).toBe(true)
    })

    it("grants a non-admin role only where the matrix lists it", () => {
        expect(can("caregiver", "daily-log")).toBe(true) // caregiver-only
        expect(can("household", "landscaping")).toBe(true) // household-only
        expect(can("family", "goals")).toBe(true)
    })

    it("denies a non-admin role where the matrix omits it", () => {
        expect(can("family", "daily-log")).toBe(false) // caregiver-only
        expect(can("caregiver", "landscaping")).toBe(false) // household-only
        expect(can("household", "vitals")).toBe(false) // caregiver-only
    })

    it("denies every non-admin role on admin-only keys", () => {
        for (const role of NON_ADMIN) {
            for (const key of ADMIN_ONLY_KEYS) {
                expect(can(role, key)).toBe(false)
            }
        }
    })

    it("fails closed on an unmapped nav key for a non-admin role", () => {
        expect(can("caregiver", "not-a-real-key" as NavKey)).toBe(false)
    })
})

describe("canWrite", () => {
    it("denies a null/undefined role (fail closed)", () => {
        expect(canWrite(null, "care")).toBe(false)
        expect(canWrite(undefined, "care")).toBe(false)
    })

    it("care writes: admin + caregiver only", () => {
        expect(canWrite("admin", "care")).toBe(true)
        expect(canWrite("caregiver", "care")).toBe(true)
        expect(canWrite("family", "care")).toBe(false)
        expect(canWrite("household", "care")).toBe(false)
    })

    it("household writes: admin + household only", () => {
        expect(canWrite("admin", "household")).toBe(true)
        expect(canWrite("household", "household")).toBe(true)
        expect(canWrite("caregiver", "household")).toBe(false)
        expect(canWrite("family", "household")).toBe(false)
    })

    it("events writes: admin + household only", () => {
        expect(canWrite("admin", "events")).toBe(true)
        expect(canWrite("household", "events")).toBe(true)
        expect(canWrite("caregiver", "events")).toBe(false)
    })

    it("admin area: admin only", () => {
        expect(canWrite("admin", "admin")).toBe(true)
        for (const role of NON_ADMIN) {
            expect(canWrite(role, "admin")).toBe(false)
        }
    })

    it("alertAck: every role may acknowledge", () => {
        for (const role of ["admin", ...NON_ADMIN] as RoleId[]) {
            expect(canWrite(role, "alertAck")).toBe(true)
        }
    })

    it("fails closed on an unknown write area", () => {
        expect(canWrite("admin", "not-an-area" as WriteArea)).toBe(false)
    })
})

describe("isAdminOnly", () => {
    it("is true for keys with no non-admin view access", () => {
        for (const key of ADMIN_ONLY_KEYS) {
            expect(isAdminOnly(key)).toBe(true)
        }
    })

    it("is false for keys any non-admin role can view", () => {
        expect(isAdminOnly("dashboard")).toBe(false)
        expect(isAdminOnly("daily-log")).toBe(false)
        expect(isAdminOnly("landscaping")).toBe(false)
    })
})
