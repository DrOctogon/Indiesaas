import { describe, expect, it } from "vitest"
import { VITAL_BOUNDS, checkVitalBounds } from "./vital-bounds"

/**
 * Vital bounds reject impossible entries (BUILD/06 invariant 11) without
 * rejecting genuinely abnormal-but-real readings. Bounds are recordable limits,
 * not healthy ranges.
 */

describe("checkVitalBounds", () => {
    it("accepts a plausible reading for each single-value type", () => {
        expect(checkVitalBounds("glucose", 110)).toBeNull()
        expect(checkVitalBounds("weight", 165)).toBeNull()
        expect(checkVitalBounds("hr", 72)).toBeNull()
        expect(checkVitalBounds("temp", 98.6)).toBeNull()
        expect(checkVitalBounds("spo2", 97)).toBeNull()
    })

    it("accepts an abnormal-but-real reading (does not over-reject)", () => {
        expect(checkVitalBounds("hr", 210)).toBeNull() // tachycardia, real
        expect(checkVitalBounds("glucose", 600)).toBeNull() // severe, real
        expect(checkVitalBounds("spo2", 60)).toBeNull() // critical, real
    })

    it("rejects impossible readings above the max", () => {
        expect(checkVitalBounds("hr", 9000)).toMatch(/recordable range/)
        expect(checkVitalBounds("spo2", 150)).toMatch(/recordable range/)
        expect(checkVitalBounds("glucose", 5000)).toMatch(/recordable range/)
    })

    it("rejects impossible readings below the min", () => {
        expect(checkVitalBounds("weight", 0)).toMatch(/recordable range/)
        expect(checkVitalBounds("weight", -5)).toMatch(/recordable range/)
        expect(checkVitalBounds("hr", 2)).toMatch(/recordable range/)
    })

    it("boundary values are inclusive", () => {
        expect(checkVitalBounds("spo2", 100)).toBeNull()
        expect(checkVitalBounds("spo2", 50)).toBeNull()
        expect(checkVitalBounds("hr", 10)).toBeNull()
        expect(checkVitalBounds("hr", 300)).toBeNull()
    })

    describe("bp (dual value)", () => {
        it("accepts a coherent systolic/diastolic pair", () => {
            expect(checkVitalBounds("bp", 120, 80)).toBeNull()
        })

        it("requires a diastolic value2", () => {
            expect(checkVitalBounds("bp", 120)).toMatch(/requires a diastolic/)
        })

        it("rejects an out-of-range diastolic", () => {
            expect(checkVitalBounds("bp", 120, 500)).toMatch(/recordable range/)
        })

        it("rejects systolic not greater than diastolic", () => {
            expect(checkVitalBounds("bp", 80, 120)).toMatch(
                /systolic must be greater/
            )
            expect(checkVitalBounds("bp", 90, 90)).toMatch(
                /systolic must be greater/
            )
        })
    })

    it("covers every vital type in the bounds table", () => {
        for (const type of Object.keys(VITAL_BOUNDS)) {
            const b = VITAL_BOUNDS[type as keyof typeof VITAL_BOUNDS]
            const mid = (b.min + b.max) / 2
            const secondMid = b.second
                ? (b.second.min + b.second.max) / 2
                : undefined
            // For bp, ensure systolic > diastolic by construction.
            const primary = b.second
                ? Math.max(mid, (secondMid ?? 0) + 10)
                : mid
            expect(
                checkVitalBounds(
                    type as keyof typeof VITAL_BOUNDS,
                    primary,
                    secondMid
                )
            ).toBeNull()
        }
    })
})
