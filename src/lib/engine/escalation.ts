/**
 * Escalation rule sub-engine (see BUILD/05 §pure sub-engines). Pure and
 * deterministic. Port the thresholds verbatim: a daily-log triggers escalation
 * on pain ≥ 8 (0–10), sleep < 3 hours, a mood concern flag, or a med that was
 * "reminded but not taken".
 */

export interface DailyLogSignals {
    pain?: { now?: number; worst?: number }
    sleep?: { hours?: number }
    mood?: { concernFlag?: boolean }
    meds?: { reminded?: boolean; taken?: boolean }[]
}

export type EscalationReason = "pain" | "sleep" | "mood" | "med"

export interface EscalationSignal {
    reason: EscalationReason
    detail: string
}

/** All escalation signals raised by a daily log. Empty array = nothing to escalate. */
export function shouldEscalate(log: DailyLogSignals): EscalationSignal[] {
    const signals: EscalationSignal[] = []

    const pain = Math.max(log.pain?.now ?? 0, log.pain?.worst ?? 0)
    if (pain >= 8) {
        signals.push({ reason: "pain", detail: `pain ${pain} ≥ 8` })
    }

    if (log.sleep?.hours != null && log.sleep.hours < 3) {
        signals.push({
            reason: "sleep",
            detail: `sleep ${log.sleep.hours}h < 3h`
        })
    }

    if (log.mood?.concernFlag === true) {
        signals.push({ reason: "mood", detail: "mood concern flag set" })
    }

    if (log.meds?.some((m) => m.reminded === true && m.taken !== true)) {
        signals.push({ reason: "med", detail: "med reminded but not taken" })
    }

    return signals
}
