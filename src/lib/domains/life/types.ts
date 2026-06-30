import { z } from "zod"

/**
 * Life-domain types + input validation (see BUILD/03-data-model.md §Care
 * recipients and §Events/planning). Mirrors the canonical Care pattern: the Zod
 * `*Input` schemas validate untrusted create/update input at the server-action
 * boundary; the stored row additionally carries the Repository-assigned `id`.
 *
 * Storage is JSONB-uniform — these shapes ARE the `data` payload. Intra-domain
 * references (recipientId, eventId) are plain string fields, not DB constraints.
 */

// --- recipients ---

/** Embedded emergency contact (id is client-supplied for stable list keys). */
const emergencyContact = z
    .object({
        id: z.string().min(1),
        name: z.string().min(1),
        relation: z.string().min(1),
        phone: z.string().min(1)
    })
    .strict()

/** Embedded doctor. */
const doctor = z
    .object({
        id: z.string().min(1),
        name: z.string().min(1),
        specialty: z.string().min(1),
        phone: z.string().min(1)
    })
    .strict()

/** Validates recipient create/update input from the client (id is server-assigned). */
export const recipientInput = z
    .object({
        name: z.string().min(1),
        photo: z.string().optional(),
        dob: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "dob must be YYYY-MM-DD")
            .optional(),
        conditions: z.array(z.string()).default([]),
        allergies: z.array(z.string()).default([]),
        bloodType: z.string().optional(),
        insurance: z.string().optional(),
        notes: z.string().optional(),
        emergencyContacts: z.array(emergencyContact).default([]),
        doctors: z.array(doctor).default([])
    })
    .strict()

export type RecipientInput = z.infer<typeof recipientInput>

/** A stored recipient: the validated input plus the Repository-assigned id. */
export type Recipient = RecipientInput & { id: string }

// --- events ---

/** Event type vocabulary (see BUILD/03 §Event vocab). */
export const eventType = z.enum([
    "intimate-family-dinner",
    "small-social",
    "holiday-gathering",
    "larger-party"
])

/** Event lifecycle status (see BUILD/03 §Event vocab). */
export const eventStatus = z.enum(["planning", "confirmed", "complete"])

/** Validates event create/update input from the client (id is server-assigned). */
export const eventInput = z
    .object({
        title: z.string().min(1),
        date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
            .optional(),
        type: eventType.optional(),
        guestCount: z.number().int().min(0).optional(),
        status: eventStatus.optional(),
        notes: z.string().optional()
    })
    .strict()

export type EventInput = z.infer<typeof eventInput>

/** A stored event: the validated input plus the Repository-assigned id. */
export type CareEvent = EventInput & { id: string }

/** Validates event-task create/update input (id and eventId server/parent supplied). */
export const eventTaskInput = z
    .object({
        eventId: z.string().min(1),
        label: z.string().min(1),
        due: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "due must be YYYY-MM-DD")
            .optional(),
        owner: z.string().optional(),
        done: z.boolean().default(false)
    })
    .strict()

export type EventTaskInput = z.infer<typeof eventTaskInput>

/** A stored event task: the validated input plus the Repository-assigned id. */
export type EventTask = EventTaskInput & { id: string }
