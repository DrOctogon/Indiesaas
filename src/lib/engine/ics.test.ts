import { describe, expect, it } from "vitest"
import { buildIcs } from "./ics"

const stamp = new Date("2026-06-30T12:00:00.000Z")

describe("buildIcs", () => {
    it("emits a valid VCALENDAR with CRLF line breaks", () => {
        const ics = buildIcs([], [], stamp)
        expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true)
        expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true)
        expect(ics).toContain("VERSION:2.0")
    })

    it("renders a timed VEVENT from a visit", () => {
        const ics = buildIcs(
            [
                {
                    id: "vi-1",
                    title: "Morning check-in",
                    start: "2026-06-30T16:00:00.000Z",
                    end: "2026-06-30T17:00:00.000Z"
                }
            ],
            [],
            stamp
        )
        expect(ics).toContain("UID:vi-1@homecare")
        expect(ics).toContain("DTSTART:20260630T160000Z")
        expect(ics).toContain("DTEND:20260630T170000Z")
        expect(ics).toContain("SUMMARY:Morning check-in")
    })

    it("renders an all-day VEVENT from an event and skips dateless ones", () => {
        const ics = buildIcs(
            [],
            [
                { id: "ev-1", title: "Birthday", date: "2026-07-04" },
                { id: "ev-2", title: "No date" }
            ],
            stamp
        )
        expect(ics).toContain("DTSTART;VALUE=DATE:20260704")
        expect(ics).not.toContain("ev-2@homecare")
    })

    it("escapes special characters per RFC 5545", () => {
        const ics = buildIcs(
            [
                {
                    id: "vi-2",
                    title: "Visit; with, chars",
                    start: "2026-06-30T16:00:00.000Z",
                    end: "2026-06-30T17:00:00.000Z"
                }
            ],
            [],
            stamp
        )
        expect(ics).toContain("SUMMARY:Visit\\; with\\, chars")
    })
})
