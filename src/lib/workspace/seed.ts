import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import {
    careTaskProtocols,
    documents,
    operatingRhythms
} from "@/database/collections"
import { db } from "@/database/db"

/**
 * Per-workspace seed content (see BUILD/03-data-model.md §Seed). Loaded once,
 * idempotently, when a workspace is created (org-plugin `afterCreateOrganization`
 * hook) so a fresh workspace is usable on day one. Seed content is product
 * content, not test fixtures — there are no demo users or demo accounts.
 *
 * This runs before the M2 generic Repository exists, so it inserts directly via
 * the Drizzle client. Each row is the uniform `{ id, workspace_id, data }`
 * shape; the typed domain object lives in `data` (with `id` mirrored inside).
 */

const prefixedId = (prefix: string): string => `${prefix}-${randomUUID()}`

/** 5 best-practice care-task protocols. */
const CARE_TASK_PROTOCOLS = [
    {
        name: "Fall prevention",
        category: "safety",
        standard: "ADL",
        steps: [
            "Clear walkways and remove trip hazards",
            "Ensure adequate lighting, especially at night",
            "Check footwear for fit and grip",
            "Confirm mobility aids are within reach"
        ]
    },
    {
        name: "Medication adherence",
        category: "meds",
        standard: "IADL",
        steps: [
            "Confirm each scheduled med against the regimen",
            "Observe administration where required",
            "Log taken / missed / skipped",
            "Flag reminded-but-not-taken for escalation"
        ]
    },
    {
        name: "Hydration",
        category: "meals",
        standard: "ADL",
        steps: [
            "Offer fluids on a regular cadence",
            "Track cups across the shift",
            "Watch for signs of dehydration"
        ]
    },
    {
        name: "Skin integrity",
        category: "hygiene",
        standard: "ADL",
        steps: [
            "Inspect pressure points",
            "Reposition on schedule",
            "Keep skin clean and dry",
            "Document any breakdown"
        ]
    },
    {
        name: "Infection control",
        category: "hygiene",
        standard: "ADL",
        steps: [
            "Hand hygiene before and after care",
            "Monitor temperature and symptoms",
            "Isolate and report suspected infection"
        ]
    }
] as const

/** Legal / estate documents checklist (groups A–G), all seeded as status "need". */
const DOCUMENTS_CHECKLIST = [
    { group: "A", docType: "Advance directive" },
    { group: "A", docType: "HIPAA authorization" },
    { group: "A", docType: "POLST" },
    { group: "B", docType: "Durable power of attorney (DPOA)" },
    { group: "C", docType: "Will" },
    { group: "C", docType: "Living trust" },
    { group: "D", docType: "Property deeds" },
    { group: "E", docType: "Leases" },
    { group: "F", docType: "Insurance policies" },
    { group: "G", docType: "Financial accounts" },
    { group: "G", docType: "Beneficiary designations" }
] as const

/** Default operating rhythms. */
const OPERATING_RHYTHMS = [
    { name: "Weekly care check-in", cadence: "weekly" },
    { name: "Monthly operations review", cadence: "monthly" }
] as const

interface SeedRow {
    id: string
    workspaceId: string
    data: Record<string, unknown>
}

function rows(
    workspaceId: string,
    prefix: string,
    items: readonly Record<string, unknown>[]
): SeedRow[] {
    return items.map((item) => {
        const id = prefixedId(prefix)
        return { id, workspaceId, data: { id, ...item } }
    })
}

/**
 * Idempotently seed a workspace. Safe to call more than once: if the workspace
 * already has seeded care-task protocols it is treated as seeded and the call
 * is a no-op.
 */
export async function seedWorkspace(workspaceId: string): Promise<void> {
    const existing = await db
        .select({ id: careTaskProtocols.id })
        .from(careTaskProtocols)
        .where(eq(careTaskProtocols.workspaceId, workspaceId))
        .limit(1)
    if (existing.length > 0) {
        return
    }

    await db
        .insert(careTaskProtocols)
        .values(rows(workspaceId, "ctp", CARE_TASK_PROTOCOLS))
    await db.insert(documents).values(
        rows(
            workspaceId,
            "doc",
            DOCUMENTS_CHECKLIST.map((d) => ({ ...d, status: "need" }))
        )
    )
    await db
        .insert(operatingRhythms)
        .values(rows(workspaceId, "or", OPERATING_RHYTHMS))
}
