import { describe, expect, it } from "vitest"
import { minutesBetween, todayISO, zonedToUtc } from "./time"

const TZ = "America/Los_Angeles" // UTC-7 in summer

describe("zonedToUtc", () => {
    it("converts a workspace-local date+time to the correct UTC instant", () => {
        // 2026-06-30 09:00 PDT === 2026-06-30 16:00 UTC
        expect(zonedToUtc("2026-06-30", "09:00", TZ).toISOString()).toBe(
            "2026-06-30T16:00:00.000Z"
        )
    })

    it("defaults to 23:59 local when no time is given", () => {
        expect(zonedToUtc("2026-06-30", undefined, TZ).toISOString()).toBe(
            "2026-07-01T06:59:00.000Z"
        )
    })
})

describe("todayISO", () => {
    it("returns the workspace-local calendar date, not the UTC date", () => {
        // 2026-07-01 05:00 UTC is still 2026-06-30 in PDT
        const now = new Date("2026-07-01T05:00:00.000Z")
        expect(todayISO(now, TZ)).toBe("2026-06-30")
    })
})

describe("minutesBetween", () => {
    it("returns signed minutes from a to b", () => {
        const a = new Date("2026-06-30T09:00:00Z")
        const b = new Date("2026-06-30T09:45:00Z")
        expect(minutesBetween(a, b)).toBe(45)
        expect(minutesBetween(b, a)).toBe(-45)
    })
})
