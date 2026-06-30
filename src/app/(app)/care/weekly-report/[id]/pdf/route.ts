import type { NextRequest } from "next/server"
import type { WeeklyReport } from "@/lib/domains/care/types"
import {
    ForbiddenError,
    UnauthorizedError,
    requireAccess
} from "@/lib/rbac/guards"
import { renderWeeklyReportPdf } from "@/lib/reports/weekly-report-pdf"
import { Repository } from "@/lib/repository"

/**
 * GET /care/weekly-report/[id]/pdf — download a weekly report as a PDF.
 *
 * Guard FIRST (`requireAccess("weekly-report")`), then load the report through
 * the workspace-scoped Repository (never raw `db`), so a report from another
 * workspace is indistinguishable from a missing one (both → 404). Auth failures
 * map to 401/403; nothing throws raw past the handler.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
    try {
        const ctx = await requireAccess("weekly-report")
        const { id } = await params
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const report = await repo.get<WeeklyReport>("weeklyReports", id)
        if (!report) {
            return new Response("Weekly report not found.", { status: 404 })
        }

        const pdf = await renderWeeklyReportPdf(report)
        const filename = `weekly-report-${report.weekStart}.pdf`
        return new Response(new Uint8Array(pdf), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "private, no-store"
            }
        })
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return new Response("Authentication required.", { status: 401 })
        }
        if (error instanceof ForbiddenError) {
            return new Response("Forbidden.", { status: 403 })
        }
        console.error("[weekly-report-pdf] unexpected error", error)
        return new Response("Something went wrong.", { status: 500 })
    }
}
