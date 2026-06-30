import { describe, expect, it } from "vitest"
import {
    detectConflicts,
    findUpcomingVisits,
    visitsOverlap
} from "./scheduling"

const visit = (id: string, start: string, end: string) => ({ id, start, end })

describe("visitsOverlap", () => {
    it("detects overlapping half-open intervals", () => {
        expect(
            visitsOverlap(
                visit("a", "2026-06-30T09:00:00Z", "2026-06-30T10:00:00Z"),
                visit("b", "2026-06-30T09:30:00Z", "2026-06-30T10:30:00Z")
            )
        ).toBe(true)
    })

    it("treats touching endpoints as non-overlapping", () => {
        expect(
            visitsOverlap(
                visit("a", "2026-06-30T09:00:00Z", "2026-06-30T10:00:00Z"),
                visit("b", "2026-06-30T10:00:00Z", "2026-06-30T11:00:00Z")
            )
        ).toBe(false)
    })
})

describe("detectConflicts", () => {
    it("returns each overlapping pair once", () => {
        const visits = [
            visit("a", "2026-06-30T09:00:00Z", "2026-06-30T10:00:00Z"),
            visit("b", "2026-06-30T09:30:00Z", "2026-06-30T10:30:00Z"),
            visit("c", "2026-06-30T11:00:00Z", "2026-06-30T12:00:00Z")
        ]
        const conflicts = detectConflicts(visits)
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0]?.map((v) => v.id)).toEqual(["a", "b"])
    })
})

describe("findUpcomingVisits", () => {
    it("returns visits starting within the window, not past ones", () => {
        const now = new Date("2026-06-30T09:00:00Z")
        const visits = [
            visit("soon", "2026-06-30T09:20:00Z", "2026-06-30T10:00:00Z"),
            visit("later", "2026-06-30T11:00:00Z", "2026-06-30T12:00:00Z"),
            visit("past", "2026-06-30T08:00:00Z", "2026-06-30T08:30:00Z")
        ]
        expect(findUpcomingVisits(visits, now, 30).map((v) => v.id)).toEqual([
            "soon"
        ])
    })
})
