/**
 * Clinical plausibility bounds for vital entries (BUILD/06 invariant 11 — "vital
 * bounds validation to reject impossible entries"). These are NOT normal/healthy
 * ranges — they are the widest physiologically *recordable* limits, chosen to
 * reject data-entry mistakes (a heart rate of 9000, a negative weight) without
 * rejecting a genuinely abnormal-but-real reading. Enforced at the input
 * boundary by `vitalInput` in `./types`.
 *
 * Units are free-text on the entry, so temp/weight bounds are deliberately
 * unit-agnostic and wide enough to admit both metric and imperial values.
 */

import type { z } from "zod"

export type VitalType = "bp" | "glucose" | "weight" | "hr" | "temp" | "spo2"

interface Bound {
    /** Inclusive minimum for the primary `value`. */
    min: number
    /** Inclusive maximum for the primary `value`. */
    max: number
    /** Human label for the primary value, used in messages. */
    label: string
    /** Bounds for the secondary `value2` (diastolic on `bp`); absent when unused. */
    second?: { min: number; max: number; label: string }
}

/** Recordable min/max per vital type. `bp` carries a required diastolic (`value2`). */
export const VITAL_BOUNDS: Record<VitalType, Bound> = {
    bp: {
        min: 40,
        max: 300,
        label: "systolic",
        second: { min: 20, max: 200, label: "diastolic" }
    },
    glucose: { min: 10, max: 1000, label: "glucose" },
    weight: { min: 1, max: 1500, label: "weight" },
    hr: { min: 10, max: 300, label: "heart rate" },
    // Wide enough for °C (25–46) and °F (80–115); rejects impossible extremes.
    temp: { min: 25, max: 115, label: "temperature" },
    spo2: { min: 50, max: 100, label: "SpO₂" }
}

const outOfRange = (
    v: number,
    b: { min: number; max: number; label: string }
): string | null =>
    v < b.min || v > b.max
        ? `${b.label} ${v} is outside the recordable range ${b.min}–${b.max}`
        : null

/**
 * Validate a vital reading against its clinical bounds. Returns an error message
 * when the reading is impossible, or `null` when acceptable. `bp` requires a
 * diastolic `value2`; other types ignore `value2`.
 */
export function checkVitalBounds(
    type: VitalType,
    value: number,
    value2?: number
): string | null {
    const bound = VITAL_BOUNDS[type]
    if (!bound) return `unknown vital type '${type}'`

    const primary = outOfRange(value, bound)
    if (primary) return primary

    if (bound.second) {
        if (value2 === undefined) {
            return `${type} requires a ${bound.second.label} value`
        }
        const secondary = outOfRange(value2, bound.second)
        if (secondary) return secondary
        // Systolic must exceed diastolic for a coherent blood-pressure reading.
        if (value <= value2) {
            return "systolic must be greater than diastolic"
        }
    }

    return null
}

/**
 * Attach vital-bounds checking to a Zod `vitalInput` object via `superRefine`,
 * so an out-of-range reading fails validation at the boundary with a clear
 * message. Kept here (not inline in the schema) so the pure rule is unit-tested.
 */
export function refineVitalBounds(
    input: { type: VitalType; value: number; value2?: number },
    ctx: z.RefinementCtx
): void {
    const message = checkVitalBounds(input.type, input.value, input.value2)
    if (message) {
        ctx.addIssue({ code: "custom", message, path: ["value"] })
    }
}
