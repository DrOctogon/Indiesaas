/**
 * Calendar ICS export (see BUILD/05 §4). Pure RFC 5545 builder with no external
 * dependency: timed VEVENTs from visits (UTC), all-day VEVENTs from events,
 * proper text escaping and CRLF line breaks. Importable into Google/Apple/Outlook.
 */

export interface IcsVisit {
    id: string
    title: string
    /** ISO datetime. */
    start: string
    /** ISO datetime. */
    end: string
    location?: string
    notes?: string
}

export interface IcsEvent {
    id: string
    title: string
    /** `YYYY-MM-DD` (all-day). */
    date?: string
    notes?: string
}

const CRLF = "\r\n"

/** Escape text per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline). */
function escapeText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n")
}

/** UTC timestamp form `YYYYMMDDTHHMMSSZ`. */
function toUtcStamp(iso: string): string {
    return new Date(Date.parse(iso))
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")
}

/** Date-only form `YYYYMMDD`. */
function toDateStamp(dateISO: string): string {
    return dateISO.replace(/-/g, "")
}

function fold(line: string): string {
    // RFC 5545 §3.1 line folding at 75 octets; simple char-based fold is adequate.
    if (line.length <= 75) return line
    const chunks: string[] = []
    let rest = line
    chunks.push(rest.slice(0, 75))
    rest = rest.slice(75)
    while (rest.length > 74) {
        chunks.push(` ${rest.slice(0, 74)}`)
        rest = rest.slice(74)
    }
    if (rest.length) chunks.push(` ${rest}`)
    return chunks.join(CRLF)
}

/**
 * Build a VCALENDAR from visits + events. `stamp` is the DTSTAMP instant
 * (injected for determinism — pure).
 */
export function buildIcs(
    visits: readonly IcsVisit[],
    events: readonly IcsEvent[],
    stamp: Date
): string {
    const dtstamp = toUtcStamp(stamp.toISOString())
    const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//HomeCare//Schedule//EN",
        "CALSCALE:GREGORIAN"
    ]

    for (const visit of visits) {
        lines.push(
            "BEGIN:VEVENT",
            `UID:${visit.id}@homecare`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART:${toUtcStamp(visit.start)}`,
            `DTEND:${toUtcStamp(visit.end)}`,
            `SUMMARY:${escapeText(visit.title)}`
        )
        if (visit.location) {
            lines.push(`LOCATION:${escapeText(visit.location)}`)
        }
        if (visit.notes) {
            lines.push(`DESCRIPTION:${escapeText(visit.notes)}`)
        }
        lines.push("END:VEVENT")
    }

    for (const event of events) {
        if (!event.date) continue
        lines.push(
            "BEGIN:VEVENT",
            `UID:${event.id}@homecare`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART;VALUE=DATE:${toDateStamp(event.date)}`,
            `SUMMARY:${escapeText(event.title)}`
        )
        if (event.notes) {
            lines.push(`DESCRIPTION:${escapeText(event.notes)}`)
        }
        lines.push("END:VEVENT")
    }

    lines.push("END:VCALENDAR")
    return lines.map(fold).join(CRLF) + CRLF
}
