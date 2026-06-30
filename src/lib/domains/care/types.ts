import { z } from "zod"

/**
 * Care-domain types + input validation (see BUILD/03 §Care collections).
 *
 * The `DailyLog` shape is the JSONB payload stored in the `dailyLogs`
 * collection. The Zod `dailyLogInput` schema validates untrusted create/update
 * input at the server-action boundary; the stored row additionally carries the
 * app-generated `id` (added by the Repository). The nested groups deliberately
 * mirror the fields the escalation engine reads — `pain.{now,worst}`,
 * `sleep.hours`, `mood.concernFlag`, `meds[].{reminded,taken}` — so a saved log
 * can be fed straight into `shouldEscalate`.
 */

const sleepQuality = z.enum(["poor", "fair", "good", "great"])
const mealAmount = z.enum(["none", "few-bites", "half", "most", "all"])

const mealEntry = z
    .object({
        description: z.string().optional(),
        amount: mealAmount.optional()
    })
    .strict()

const dailyLogMed = z
    .object({
        time: z.string().optional(),
        med: z.string().optional(),
        reminded: z.boolean().optional(),
        taken: z.boolean().optional(),
        notes: z.string().optional(),
        medicationId: z.string().optional(),
        medLogId: z.string().optional()
    })
    .strict()

/** Validates daily-log create/update input from the client (id is server-assigned). */
export const dailyLogInput = z
    .object({
        date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
        caregiverId: z.string().min(1),
        sleep: z
            .object({
                hours: z.number().min(0).max(24).optional(),
                quality: sleepQuality.optional(),
                napMinutes: z.number().min(0).optional(),
                notes: z.string().optional()
            })
            .strict()
            .optional(),
        mood: z
            .object({
                overall: z.string().optional(),
                engagement: z.string().optional(),
                griefNotes: z.string().optional(),
                concernFlag: z.boolean().optional()
            })
            .strict()
            .optional(),
        pain: z
            .object({
                now: z.number().min(0).max(10).optional(),
                worst: z.number().min(0).max(10).optional(),
                locations: z.array(z.string()).optional(),
                helpedBy: z.string().optional(),
                comfort: z.string().optional()
            })
            .strict()
            .optional(),
        meals: z
            .object({
                breakfast: mealEntry.optional(),
                lunch: mealEntry.optional(),
                dinner: mealEntry.optional(),
                snacks: mealEntry.optional()
            })
            .strict()
            .optional(),
        hydrationCups: z.number().min(0).optional(),
        activity: z
            .object({
                description: z.string().optional(),
                activeMinutes: z.number().min(0).optional(),
                outdoors: z.boolean().optional()
            })
            .strict()
            .optional(),
        social: z
            .array(
                z
                    .object({
                        who: z.string(),
                        type: z.string(),
                        notes: z.string().optional()
                    })
                    .strict()
            )
            .optional(),
        meds: z.array(dailyLogMed).optional(),
        notableEvents: z.array(z.string()).optional(),
        followUps: z
            .array(
                z
                    .object({
                        item: z.string(),
                        owner: z.string().optional(),
                        due: z.string().optional()
                    })
                    .strict()
            )
            .optional()
    })
    .strict()

export type DailyLogInput = z.infer<typeof dailyLogInput>

/** A stored daily log: the validated input plus the Repository-assigned id. */
export type DailyLog = DailyLogInput & { id: string }
