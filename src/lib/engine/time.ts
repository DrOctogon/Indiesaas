/**
 * Workspace-local time (see BUILD/06 invariant 12 + BUILD/05 §pure sub-engines).
 *
 * Every date / overdue / due-time / reminder / "today" computation runs in the
 * workspace's IANA timezone, NEVER server UTC — a wrong timezone silently shifts
 * "today" and overdue by up to a day, so this is a correctness invariant, not a
 * display preference. These functions are pure: the timezone and `now` instant
 * are always injected, never read from an ambient clock.
 */

interface ZonedParts {
    year: number
    month: number // 1-12
    day: number
    hour: number
    minute: number
    second: number
}

/** The wall-clock parts an IANA timezone shows for a given UTC instant. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })
    const lookup: Record<string, number> = {}
    for (const part of formatter.formatToParts(instant)) {
        if (part.type !== "literal") {
            lookup[part.type] = Number(part.value)
        }
    }
    // "24" hour can appear at midnight in some environments; normalize to 0.
    const hour = lookup.hour === 24 ? 0 : (lookup.hour ?? 0)
    return {
        year: lookup.year ?? 1970,
        month: lookup.month ?? 1,
        day: lookup.day ?? 1,
        hour,
        minute: lookup.minute ?? 0,
        second: lookup.second ?? 0
    }
}

/** Milliseconds the timezone is offset from UTC at `instant` (positive = ahead of UTC). */
function offsetMs(instant: Date, timeZone: string): number {
    const p = zonedParts(instant, timeZone)
    const asUtc = Date.UTC(
        p.year,
        p.month - 1,
        p.day,
        p.hour,
        p.minute,
        p.second
    )
    return asUtc - instant.getTime()
}

/**
 * The UTC instant for a workspace-local wall time. `dateISO` is `YYYY-MM-DD`,
 * `timeHHmm` is `HH:mm` (defaults to `23:59`, the care-task default due time).
 */
export function zonedToUtc(
    dateISO: string,
    timeHHmm: string | undefined,
    timeZone: string
): Date {
    const [year, month, day] = dateISO.split("-").map(Number)
    const [hour, minute] = (timeHHmm ?? "23:59").split(":").map(Number)
    const utcGuess = Date.UTC(
        year ?? 1970,
        (month ?? 1) - 1,
        day ?? 1,
        hour ?? 0,
        minute ?? 0
    )
    // Correct the guess by the zone offset at that instant (DST-aware enough for
    // a single correction step away from a transition boundary).
    const offset = offsetMs(new Date(utcGuess), timeZone)
    return new Date(utcGuess - offset)
}

/** "Today" in the workspace timezone, as `YYYY-MM-DD`. */
export function todayISO(now: Date, timeZone: string): string {
    const p = zonedParts(now, timeZone)
    const mm = String(p.month).padStart(2, "0")
    const dd = String(p.day).padStart(2, "0")
    return `${p.year}-${mm}-${dd}`
}

/** Minutes between two instants (b - a). */
export function minutesBetween(a: Date, b: Date): number {
    return (b.getTime() - a.getTime()) / 60000
}
