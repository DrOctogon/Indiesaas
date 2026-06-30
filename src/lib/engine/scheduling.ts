import { minutesBetween } from "@/lib/engine/time"

/**
 * Scheduling sub-engine (see BUILD/05 §pure sub-engines). Pure. "Upcoming"
 * windows are evaluated against the injected `now`; visit instants are absolute
 * (ISO datetimes), so overlap/conflict detection is timezone-independent, while
 * the reminder window is a simple minutes-from-now check.
 */

export interface VisitLike {
    id: string
    /** ISO datetime. */
    start: string
    /** ISO datetime. */
    end: string
}

/** Whether two visits overlap in time (half-open intervals). */
export function visitsOverlap(a: VisitLike, b: VisitLike): boolean {
    const aStart = Date.parse(a.start)
    const aEnd = Date.parse(a.end)
    const bStart = Date.parse(b.start)
    const bEnd = Date.parse(b.end)
    return aStart < bEnd && bStart < aEnd
}

/** All overlapping visit pairs. */
export function detectConflicts<T extends VisitLike>(
    visits: readonly T[]
): [T, T][] {
    const conflicts: [T, T][] = []
    for (let i = 0; i < visits.length; i++) {
        for (let j = i + 1; j < visits.length; j++) {
            const a = visits[i]
            const b = visits[j]
            if (a && b && visitsOverlap(a, b)) {
                conflicts.push([a, b])
            }
        }
    }
    return conflicts
}

/**
 * Visits starting within `withinMinutes` from `now` (and not already started) —
 * the set the "send reminders" sweep fires on.
 */
export function findUpcomingVisits<T extends VisitLike>(
    visits: readonly T[],
    now: Date,
    withinMinutes: number
): T[] {
    return visits.filter((visit) => {
        const start = new Date(Date.parse(visit.start))
        const delta = minutesBetween(now, start)
        return delta >= 0 && delta <= withinMinutes
    })
}
