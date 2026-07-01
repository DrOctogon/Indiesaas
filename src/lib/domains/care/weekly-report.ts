"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/database/db"
import { members, users } from "@/database/schema"
import {
    type WeeklyReport,
    type WeeklyReportInput,
    weeklyReportInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { sendEmail } from "@/lib/notify/channels/email"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { renderWeeklyReportPdf } from "@/lib/reports/weekly-report-pdf"
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

/** Plain-text email body summarising a weekly report; the PDF carries the detail. */
function weeklyReportBody(report: WeeklyReport): string {
    return [
        `Weekly care report for ${report.weekStart} – ${report.weekEnd}.`,
        report.highlights.length
            ? `Highlights:\n- ${report.highlights.join("\n- ")}`
            : "",
        report.concerns.length
            ? `Concerns:\n- ${report.concerns.join("\n- ")}`
            : "",
        "The full report is attached as a PDF."
    ]
        .filter(Boolean)
        .join("\n\n")
}

/**
 * Email a weekly report (as a PDF attachment) to the whole workspace care team
 * (BUILD/06 checklist — "Weekly Report can be emailed to the workspace").
 * View-gated. No-ops gracefully when email is unconfigured (`sent` is 0). Stamps
 * `sentAt` on the report. Never throws across the boundary.
 */
export async function emailWeeklyReport(
    id: string
): Promise<ActionResult<{ sent: number }>> {
    try {
        const ctx = await requireAccess("weekly-report")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const report = await repo.get<WeeklyReport>(COLLECTION, id)
        if (!report) {
            return { status: false, message: "Weekly report not found." }
        }
        // Recipients = every member of the active workspace (the care team).
        const recipients = await db
            .select({ email: users.email })
            .from(members)
            .innerJoin(users, eq(members.userId, users.id))
            .where(eq(members.organizationId, ctx.workspaceId))
        if (recipients.length === 0) {
            return { status: false, message: "No workspace members to email." }
        }
        const pdf = await renderWeeklyReportPdf(report)
        const subject = `Weekly care report — ${report.weekStart} to ${report.weekEnd}`
        const body = weeklyReportBody(report)
        const attachments = [
            { filename: `weekly-report-${report.weekStart}.pdf`, content: pdf }
        ]
        let sent = 0
        for (const recipient of recipients) {
            sent += await sendEmail(recipient.email, subject, body, attachments)
        }
        await repo.update<WeeklyReport>(COLLECTION, id, {
            sentAt: new Date().toISOString()
        })
        revalidatePath("/care/weekly-report")
        return ok({ sent })
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
