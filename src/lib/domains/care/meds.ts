"use server"

import { revalidatePath } from "next/cache"
import {
    type MedLog,
    type MedLogInput,
    type Medication,
    type MedicationInput,
    medLogInput,
    medicationInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Medication domain operations — clones the canonical daily-log pattern: guard
 * FIRST, construct the Repository from the auth context, validate untrusted
 * input with Zod at the boundary, return a typed ActionResult envelope. Meds use
 * the `health` nav key with `care`-area writes (see BUILD/04).
 */

const COLLECTION = "medications" as const
const MED_LOGS = "medLogs" as const

/** List all medications in the active workspace (view-gated). */
export async function listMedications(): Promise<ActionResult<Medication[]>> {
    try {
        const ctx = await requireAccess("health")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<Medication>(COLLECTION))
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a medication (write-gated to the `care` area). */
export async function createMedication(
    input: unknown
): Promise<ActionResult<Medication>> {
    try {
        const ctx = await requireWrite("health", "care")
        const parsed = medicationInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<MedicationInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/care/meds")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing medication (write-gated). */
export async function updateMedication(
    id: string,
    patch: unknown
): Promise<ActionResult<Medication>> {
    try {
        const ctx = await requireWrite("health", "care")
        const parsed = medicationInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Medication>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Medication not found." }
        }
        revalidatePath("/care/meds")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a medication (write-gated). Cascades its med logs (Repository). */
export async function deleteMedication(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("health", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Medication not found." }
        }
        revalidatePath("/care/meds")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}

/** List all med logs in the active workspace (view-gated). */
export async function listMedLogs(): Promise<ActionResult<MedLog[]>> {
    try {
        const ctx = await requireAccess("health")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<MedLog>(MED_LOGS))
    } catch (error) {
        return failFrom(error)
    }
}

/** Record a med log (write-gated to the `care` area). */
export async function createMedLog(
    input: unknown
): Promise<ActionResult<MedLog>> {
    try {
        const ctx = await requireWrite("health", "care")
        const parsed = medLogInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<MedLogInput>(MED_LOGS, parsed.data)
        revalidatePath("/care/meds")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}
