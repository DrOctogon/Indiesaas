import { z } from "zod"
import { refineVitalBounds } from "./vital-bounds"

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

/* -------------------------------------------------------------------------- */
/* Shared care-domain enums (see BUILD/03 §Enums & vocabularies).             */
/* -------------------------------------------------------------------------- */

const goalTrend = z.enum(["up", "flat", "down"])
const taskCategory = z.enum(["meds", "meal", "hygiene", "exercise", "other"])
const recurrence = z.enum(["once", "daily", "weekly"])
const vitalType = z.enum(["bp", "glucose", "weight", "hr", "temp", "spo2"])
const visitType = z.enum(["doctor", "therapy", "caregiver", "other"])
const medLogStatus = z.enum(["taken", "missed", "skipped"])
const occurrenceStatus = z.enum([
    "scheduled",
    "completed",
    "missed",
    "cancelled"
])
const careTaskStatus = z.enum(["assigned", "in-progress", "done", "verified"])
const actionItemPriority = z.enum(["High", "Med", "Low"])
const checklistSection = z.enum([
    "morning",
    "midday",
    "afternoon",
    "evening",
    "home",
    "safety",
    "endOfDay"
])

const idDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
const idTime = z
    .string()
    .regex(/^\d{2}:\d{2}$/, "time must be HH:mm")
    .optional()

/* -------------------------------------------------------------------------- */
/* Shift checklist (shiftChecklists)                                          */
/* -------------------------------------------------------------------------- */

const checklistItem = z
    .object({
        label: z.string().min(1),
        done: z.boolean(),
        note: z.string().optional()
    })
    .strict()

/** Validates shift-checklist create/update input (id is server-assigned). */
export const shiftChecklistInput = z
    .object({
        date: idDate,
        caregiverId: z.string().min(1),
        sections: z.record(checklistSection, z.array(checklistItem))
    })
    .strict()

export type ShiftChecklistInput = z.infer<typeof shiftChecklistInput>
export type ShiftChecklist = ShiftChecklistInput & { id: string }

/* -------------------------------------------------------------------------- */
/* Vitals (vitals)                                                            */
/* -------------------------------------------------------------------------- */

/** Validates vital create/update input. `value2` carries diastolic for bp. */
export const vitalInput = z
    .object({
        recipientId: z.string().min(1),
        type: vitalType,
        value: z.number(),
        value2: z.number().optional(),
        unit: z.string().min(1),
        takenAt: z.string().min(1),
        note: z.string().optional()
    })
    .strict()
    .superRefine((val, ctx) => refineVitalBounds(val, ctx))

export type VitalInput = z.infer<typeof vitalInput>
export type Vital = VitalInput & { id: string }

/* -------------------------------------------------------------------------- */
/* Care goals (careGoals)                                                     */
/* -------------------------------------------------------------------------- */

/** Validates care-goal create/update input (G1–G8 with done state + trend). */
export const careGoalInput = z
    .object({
        recipientId: z.string().min(1),
        label: z.string().min(1),
        done: z.boolean(),
        code: z
            .string()
            .regex(/^G[1-8]$/, "code must be G1–G8")
            .optional(),
        trend: goalTrend.optional(),
        notes: z.string().optional()
    })
    .strict()

export type CareGoalInput = z.infer<typeof careGoalInput>
export type CareGoal = CareGoalInput & { id: string }

/* -------------------------------------------------------------------------- */
/* Care tasks (careTasks) + completions (careTaskCompletions)                 */
/* -------------------------------------------------------------------------- */

/** Validates care-task create/update input. No date => never overdue. */
export const careTaskInput = z
    .object({
        recipientId: z.string().min(1),
        label: z.string().min(1),
        category: taskCategory,
        recurrence,
        time: idTime,
        date: idDate.optional(),
        doneAt: z.string().nullish()
    })
    .strict()

export type CareTaskInput = z.infer<typeof careTaskInput>
export type CareTask = CareTaskInput & { id: string }

/** Validates care-task-completion create/update input. */
export const careTaskCompletionInput = z
    .object({
        taskId: z.string().min(1),
        recipientId: z.string().min(1),
        caregiverId: z.string().min(1),
        status: careTaskStatus,
        completedAt: z.string().optional(),
        verifiedBy: z.string().optional(),
        verifiedAt: z.string().optional(),
        evidence: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type CareTaskCompletionInput = z.infer<typeof careTaskCompletionInput>
export type CareTaskCompletion = CareTaskCompletionInput & { id: string }

/* -------------------------------------------------------------------------- */
/* Weekly report (weeklyReports)                                              */
/* -------------------------------------------------------------------------- */

const goalTrendEntry = z
    .object({
        code: z.string().min(1),
        value: z.number().optional(),
        trend: goalTrend.optional(),
        note: z.string().optional()
    })
    .strict()

const apptAttended = z
    .object({
        date: z.string().min(1),
        provider: z.string().min(1),
        outcome: z.string().optional()
    })
    .strict()

const apptUpcoming = z
    .object({
        date: z.string().min(1),
        provider: z.string().min(1),
        prep: z.string().optional()
    })
    .strict()

const supplyItem = z
    .object({
        item: z.string().min(1),
        why: z.string().optional(),
        cost: z.number().optional()
    })
    .strict()

/** Validates weekly-report create/update input. */
export const weeklyReportInput = z
    .object({
        weekStart: idDate,
        weekEnd: idDate,
        sentAt: z.string().optional(),
        highlights: z.array(z.string()).default([]),
        concerns: z.array(z.string()).default([]),
        goalTrends: z.array(goalTrendEntry).default([]),
        apptsAttended: z.array(apptAttended).default([]),
        apptsUpcoming: z.array(apptUpcoming).default([]),
        householdItems: z.array(z.string()).default([]),
        supplies: z.array(supplyItem).default([]),
        questions: z.array(z.string()).default([])
    })
    .strict()

export type WeeklyReportInput = z.infer<typeof weeklyReportInput>
export type WeeklyReport = WeeklyReportInput & { id: string }

/* -------------------------------------------------------------------------- */
/* Care plans / care-task protocols (careTaskProtocols)                       */
/* -------------------------------------------------------------------------- */

/** Validates care-task-protocol (plan) create/update input. */
export const careTaskProtocolInput = z
    .object({
        name: z.string().min(1),
        category: z.string().min(1),
        standard: z.string().optional(),
        steps: z.array(z.string()).default([]),
        defaultRecurrence: recurrence.optional(),
        defaultPriority: actionItemPriority.optional()
    })
    .strict()

export type CareTaskProtocolInput = z.infer<typeof careTaskProtocolInput>
export type CareTaskProtocol = CareTaskProtocolInput & { id: string }

/* -------------------------------------------------------------------------- */
/* Schedule: visits (visits) + occurrences (scheduleOccurrences)             */
/* -------------------------------------------------------------------------- */

/** Validates visit create/update input. `start`/`end` are ISO datetimes. */
export const visitInput = z
    .object({
        recipientId: z.string().min(1),
        title: z.string().min(1),
        type: visitType,
        start: z.string().min(1),
        end: z.string().min(1),
        location: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type VisitInput = z.infer<typeof visitInput>
export type Visit = VisitInput & { id: string }

/** Validates schedule-occurrence create/update input. */
export const scheduleOccurrenceInput = z
    .object({
        visitId: z.string().min(1),
        recipientId: z.string().min(1),
        start: z.string().min(1),
        end: z.string().min(1),
        status: occurrenceStatus,
        notes: z.string().optional()
    })
    .strict()

export type ScheduleOccurrenceInput = z.infer<typeof scheduleOccurrenceInput>
export type ScheduleOccurrence = ScheduleOccurrenceInput & { id: string }

/* -------------------------------------------------------------------------- */
/* Meds: medications (medications) + med logs (medLogs)                       */
/* -------------------------------------------------------------------------- */

/** Validates medication create/update input. `times` are HH:mm strings. */
export const medicationInput = z
    .object({
        recipientId: z.string().min(1),
        name: z.string().min(1),
        dose: z.string().min(1),
        frequency: z.string().min(1),
        times: z.array(z.string()).default([]),
        active: z.boolean(),
        notes: z.string().optional()
    })
    .strict()

export type MedicationInput = z.infer<typeof medicationInput>
export type Medication = MedicationInput & { id: string }

/** Validates med-log create/update input. */
export const medLogInput = z
    .object({
        medicationId: z.string().min(1),
        recipientId: z.string().min(1),
        scheduledTime: z.string().min(1),
        takenAt: z.string().optional(),
        status: medLogStatus
    })
    .strict()

export type MedLogInput = z.infer<typeof medLogInput>
export type MedLog = MedLogInput & { id: string }
