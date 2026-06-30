"use server"

import { revalidatePath } from "next/cache"
import {
    type WeeklyReport,
    type WeeklyReportInput,
    weeklyReportInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Weekly-report domain operations — clones the canonical daily-log pattern:
 * guard FIRST, construct the Repository from the auth context, validate
 * untrusted input with Zod at the boundary, return a typed ActionResult
 * envelope. View is open to caregiver+family; writes remain in the `care` area.
 */

const COLLECTION = "weeklyReports" as const

/** List all weekly reports in the active workspace (view-gated). */
export async function listWeeklyReports(): Promise<
    ActionResult<WeeklyReport[]>
> {
    try {
        const ctx = await requireAccess("weekly-report")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<WeeklyReport>(COLLECTION))
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a weekly report (write-gated to the `care` area). */
export async function createWeeklyReport(
    input: unknown
): Promise<ActionResult<WeeklyReport>> {
    try {
        const ctx = await requireWrite("weekly-report", "care")
        const parsed = weeklyReportInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<WeeklyReportInput>(
            COLLECTION,
            parsed.data
        )
        revalidatePath("/care/weekly-report")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing weekly report (write-gated). */
export async function updateWeeklyReport(
    id: string,
    patch: unknown
): Promise<ActionResult<WeeklyReport>> {
    try {
        const ctx = await requireWrite("weekly-report", "care")
        const parsed = weeklyReportInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<WeeklyReport>(
            COLLECTION,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Weekly report not found." }
        }
        revalidatePath("/care/weekly-report")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a weekly report (write-gated). */
export async function deleteWeeklyReport(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("weekly-report", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Weekly report not found." }
        }
        revalidatePath("/care/weekly-report")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
