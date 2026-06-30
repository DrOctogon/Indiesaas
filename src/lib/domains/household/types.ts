import { z } from "zod"

/**
 * Household-domain types + input validation (see BUILD/03 §Household / estate
 * and §Landscaping). Mirrors the canonical care-domain `types.ts`: each Zod
 * `*Input` schema validates untrusted create/update input at the server-action
 * boundary; the stored row additionally carries the Repository-assigned `id`.
 *
 * Intra-domain references (`vendorId`, `zoneId`) are plain optional string
 * fields inside the JSON — they are not DB constraints (the Repository handles
 * the landscapingZones → landscapingTasks cascade on delete).
 */

/** Shared with landscapingTasks; see BUILD/03 §Enums (LandscapingSeason). */
export const landscapingSeason = z.enum([
    "spring",
    "summer",
    "fall",
    "winter",
    "year-round"
])
export type LandscapingSeason = z.infer<typeof landscapingSeason>

// --- property ---

/** Validates property create/update input (id is server-assigned). */
export const propertyInput = z
    .object({
        name: z.string().min(1),
        type: z.string().min(1),
        notes: z.string().optional()
    })
    .strict()

export type PropertyInput = z.infer<typeof propertyInput>
export type Property = PropertyInput & { id: string }

// --- maintenance ---

/** Validates maintenance-task create/update input (id is server-assigned). */
export const maintenanceTaskInput = z
    .object({
        item: z.string().min(1),
        cadence: z.string().min(1),
        season: z.string().optional(),
        vendorId: z.string().optional(),
        owner: z.string().optional(),
        lastDone: z.string().optional(),
        nextDue: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type MaintenanceTaskInput = z.infer<typeof maintenanceTaskInput>
export type MaintenanceTask = MaintenanceTaskInput & { id: string }

// --- landscaping ---

/** Validates landscaping-zone create/update input (id is server-assigned). */
export const landscapingZoneInput = z
    .object({
        name: z.string().min(1),
        area: z.string().optional(),
        plantings: z.array(z.string()).optional(),
        irrigation: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type LandscapingZoneInput = z.infer<typeof landscapingZoneInput>
export type LandscapingZone = LandscapingZoneInput & { id: string }

/** Validates landscaping-task create/update input (id is server-assigned). */
export const landscapingTaskInput = z
    .object({
        zoneId: z.string().optional(),
        label: z.string().min(1),
        season: landscapingSeason.optional(),
        cadence: z.string().optional(),
        vendorId: z.string().optional(),
        lastDone: z.string().optional(),
        nextDue: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type LandscapingTaskInput = z.infer<typeof landscapingTaskInput>
export type LandscapingTask = LandscapingTaskInput & { id: string }

/** Validates landscaping-vendor create/update input (id is server-assigned). */
export const landscapingVendorInput = z
    .object({
        name: z.string().min(1),
        service: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type LandscapingVendorInput = z.infer<typeof landscapingVendorInput>
export type LandscapingVendor = LandscapingVendorInput & { id: string }

// --- vendors ---

/** Validates vendor create/update input (id is server-assigned). */
export const vendorInput = z
    .object({
        name: z.string().min(1),
        service: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type VendorInput = z.infer<typeof vendorInput>
export type Vendor = VendorInput & { id: string }

// --- inventory ---

/** Validates inventory-item create/update input (id is server-assigned). */
export const inventoryItemInput = z
    .object({
        name: z.string().min(1),
        location: z.string().optional(),
        qty: z.number().optional(),
        notes: z.string().optional()
    })
    .strict()

export type InventoryItemInput = z.infer<typeof inventoryItemInput>
export type InventoryItem = InventoryItemInput & { id: string }

// --- tenants (admin-only) ---

/** Validates tenant create/update input (id is server-assigned). */
export const tenantInput = z
    .object({
        unit: z.string().min(1),
        name: z.string().optional(),
        rent: z.number().nullable().optional(),
        leaseStart: z.string().optional(),
        leaseEnd: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type TenantInput = z.infer<typeof tenantInput>
export type Tenant = TenantInput & { id: string }

/** Validates guest-stay create/update input (id is server-assigned). */
export const guestStayInput = z
    .object({
        guest: z.string().min(1),
        arrive: z.string().optional(),
        depart: z.string().optional(),
        notes: z.string().optional()
    })
    .strict()

export type GuestStayInput = z.infer<typeof guestStayInput>
export type GuestStay = GuestStayInput & { id: string }
