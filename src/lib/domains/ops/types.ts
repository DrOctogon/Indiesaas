import { z } from "zod"

/**
 * Operations/admin-domain types + input validation (see BUILD/03 §Operations,
 * BUILD/02 §AREA: Operations). Each Zod schema validates untrusted create/update
 * input at the server-action boundary; the stored row additionally carries the
 * Repository-assigned `id`. Enum vocabularies mirror BUILD/03 §Enums.
 */

// --- shared enum vocabularies (BUILD/03 §Enums) ---
export const alertLevel = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"])
export const alertStatus = z.enum(["open", "acknowledged", "resolved"])
export const actionItemPriority = z.enum(["High", "Med", "Low"])
export const actionItemStatus = z.enum([
    "Open",
    "In progress",
    "Blocked",
    "Done",
    "Carried over"
])
export const actionItemTag = z.enum([
    "care",
    "household",
    "family",
    "admin",
    "finance"
])
export const contactCategory = z.enum([
    "EMERGENCY",
    "FAMILY",
    "MEDICAL",
    "CARE_TEAM",
    "HOUSEHOLD",
    "PROFESSIONAL",
    "UTILITIES"
])
export const contactVisibility = z.enum(["shared", "role"])
export const role = z.enum(["admin", "caregiver", "family", "household"])
export const docStatus = z.enum(["need", "in-progress", "have", "unknown"])
export const budgetKind = z.enum(["expense", "income"])
export const rhythmCadence = z.enum(["daily", "weekly", "monthly", "quarterly"])

// --- alerts ---
/** Validates alert create/update input from the client (id is server-assigned). */
export const alertInput = z
    .object({
        createdAt: z.string().min(1),
        level: alertLevel,
        category: z.string().min(1),
        description: z.string().min(1),
        acknowledgedBy: z.string().optional(),
        acknowledgedAt: z.string().optional(),
        actionItemId: z.string().optional(),
        status: alertStatus.optional(),
        sourceId: z.string().optional(),
        ruleId: z.string().optional(),
        dedupeKey: z.string().optional(),
        resolvedAt: z.string().optional(),
        resolvedBy: z.string().optional()
    })
    .strict()

export type AlertInput = z.infer<typeof alertInput>
export type Alert = AlertInput & { id: string }

// --- action items ---
/** Validates action-item create/update input from the client (id is server-assigned). */
export const actionItemInput = z
    .object({
        openedDate: z.string().min(1),
        description: z.string().min(1),
        owner: z.string().optional(),
        dueDate: z.string().optional(),
        priority: actionItemPriority,
        status: actionItemStatus,
        tag: actionItemTag.optional(),
        notes: z.string().optional()
    })
    .strict()

export type ActionItemInput = z.infer<typeof actionItemInput>
export type ActionItem = ActionItemInput & { id: string }

// --- contacts ---
/** Validates contact create/update input from the client (id is server-assigned). */
export const contactInput = z
    .object({
        name: z.string().min(1),
        role: z.string().optional(),
        category: contactCategory,
        phone: z.string().optional(),
        email: z.string().optional(),
        notes: z.string().optional(),
        active: z.boolean().optional(),
        visibility: contactVisibility.optional(),
        visibleToRoles: z.array(role).optional()
    })
    .strict()

export type ContactInput = z.infer<typeof contactInput>
export type Contact = ContactInput & { id: string }

// --- operating rhythms ---
/** Validates operating-rhythm create/update input from the client (id is server-assigned). */
export const operatingRhythmInput = z
    .object({
        name: z.string().min(1),
        cadence: rhythmCadence,
        dayOfWeek: z.string().optional(),
        time: z.string().optional(),
        owner: z.string().optional(),
        nextScheduled: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type OperatingRhythmInput = z.infer<typeof operatingRhythmInput>
export type OperatingRhythm = OperatingRhythmInput & { id: string }

// --- budget lines (admin-only) ---
/** Validates budget-line create/update input from the client (id is server-assigned). */
export const budgetLineInput = z
    .object({
        category: z.string().min(1),
        kind: budgetKind,
        monthlyBudget: z.number().nullable().optional(),
        monthlyActual: z.number().nullable().optional(),
        annual: z.number().nullable().optional(),
        notes: z.string().optional()
    })
    .strict()

export type BudgetLineInput = z.infer<typeof budgetLineInput>
export type BudgetLine = BudgetLineInput & { id: string }

// --- documents (admin-only) ---
/** Validates document create/update input from the client (id is server-assigned). */
export const documentInput = z
    .object({
        docType: z.string().min(1),
        status: docStatus,
        group: z.string().optional(),
        location: z.string().optional(),
        expiration: z.string().optional(),
        lastReviewed: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type DocumentInput = z.infer<typeof documentInput>
export type AppDocument = DocumentInput & { id: string }
