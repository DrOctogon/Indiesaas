import { describe, expect, it } from "vitest"
import { shouldEscalate } from "./escalation"

/**
 * Escalation thresholds are ported verbatim from BUILD/05: pain ≥ 8 (0–10),
 * sleep < 3h, mood concern flag, or a med reminded-but-not-taken.
 */
describe("shouldEscalate", () => {
    it("escalates pain >= 8 (uses max of now/worst)", () => {
        expect(shouldEscalate({ pain: { now: 8 } })).toEqual([
            { reason: "pain", detail: "pain 8 ≥ 8" }
        ])
        expect(shouldEscalate({ pain: { now: 2, worst: 9 } })[0]?.reason).toBe(
            "pain"
        )
    })

    it("does not escalate pain < 8", () => {
        expect(shouldEscalate({ pain: { now: 7, worst: 7 } })).toEqual([])
    })

    it("escalates sleep < 3h but not >= 3h", () => {
        expect(shouldEscalate({ sleep: { hours: 2.5 } })[0]?.reason).toBe(
            "sleep"
        )
        expect(shouldEscalate({ sleep: { hours: 3 } })).toEqual([])
    })

    it("escalates a mood concern flag", () => {
        expect(shouldEscalate({ mood: { concernFlag: true } })[0]?.reason).toBe(
            "mood"
        )
        expect(shouldEscalate({ mood: { concernFlag: false } })).toEqual([])
    })

    it("escalates a med reminded but not taken", () => {
        expect(
            shouldEscalate({ meds: [{ reminded: true, taken: false }] })[0]
                ?.reason
        ).toBe("med")
        expect(
            shouldEscalate({ meds: [{ reminded: true, taken: true }] })
        ).toEqual([])
        expect(
            shouldEscalate({ meds: [{ reminded: false, taken: false }] })
        ).toEqual([])
    })

    it("returns multiple signals at once and empty for a clean log", () => {
        const signals = shouldEscalate({
            pain: { worst: 10 },
            sleep: { hours: 1 },
            mood: { concernFlag: true }
        })
        expect(signals.map((s) => s.reason).sort()).toEqual([
            "mood",
            "pain",
            "sleep"
        ])
        expect(shouldEscalate({})).toEqual([])
    })
})
