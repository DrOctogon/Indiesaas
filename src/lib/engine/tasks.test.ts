import { describe, expect, it } from "vitest"
import { findOverdueTasks, isOverdue, taskDueAt } from "./tasks"

/**
 * Overdue is evaluated in WORKSPACE-LOCAL time (BUILD/05). The default due time
 * is 23:59 local. A task due "today" in the workspace tz must NOT be flagged
 * overdue just because the server clock (UTC) has rolled past midnight.
 */
const TZ = "America/Los_Angeles" // UTC-7 in summer (DST)

describe("taskDueAt", () => {
    it("resolves the workspace-local default 23:59 to the right UTC instant", () => {
        const due = taskDueAt({ id: "t-1", date: "2026-06-30" }, TZ)
        // 2026-06-30 23:59 PDT === 2026-07-01 06:59 UTC
        expect(due?.toISOString()).toBe("2026-07-01T06:59:00.000Z")
    })

    it("returns null for a task with no date", () => {
        expect(taskDueAt({ id: "t-2" }, TZ)).toBeNull()
    })
})

describe("isOverdue", () => {
    it("is NOT overdue before the local due time, even past UTC midnight", () => {
        const task = { id: "t-1", date: "2026-06-30" }
        // 2026-07-01 05:00 UTC === 2026-06-30 22:00 PDT (before 23:59 local)
        const now = new Date("2026-07-01T05:00:00.000Z")
        expect(isOverdue(task, now, TZ)).toBe(false)
    })

    it("is overdue once the local due time has passed", () => {
        const task = { id: "t-1", date: "2026-06-30" }
        // 2026-07-01 07:30 UTC === 2026-07-01 00:30 PDT (after 23:59 prev day)
        const now = new Date("2026-07-01T07:30:00.000Z")
        expect(isOverdue(task, now, TZ)).toBe(true)
    })

    it("a completed task is never overdue", () => {
        const task = {
            id: "t-1",
            date: "2020-01-01",
            doneAt: "2020-01-01T10:00:00.000Z"
        }
        expect(isOverdue(task, new Date("2026-07-01T00:00:00.000Z"), TZ)).toBe(
            false
        )
    })
})

describe("findOverdueTasks", () => {
    it("returns only the overdue, not-done tasks", () => {
        const now = new Date("2026-07-01T07:30:00.000Z")
        const tasks = [
            { id: "t-overdue", date: "2026-06-29" },
            { id: "t-future", date: "2026-07-05" },
            { id: "t-none" }
        ]
        expect(findOverdueTasks(tasks, now, TZ).map((t) => t.id)).toEqual([
            "t-overdue"
        ])
    })
})
