import { listWeeklyReports } from "@/lib/domains/care/weekly-report"
import { requireAccess } from "@/lib/rbac/guards"
import { NewWeeklyReportForm } from "./new-weekly-report-form"

/**
 * Weekly-report page — clones the canonical daily-log route. View guard first
 * (open to caregiver+family); data read through the guard-re-checking domain
 * action, scoped to the active workspace by the Repository.
 */
export default async function WeeklyReportPage() {
    try {
        await requireAccess("weekly-report")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Weekly report</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to weekly reports in this workspace.
                </p>
            </main>
        )
    }

    const result = await listWeeklyReports()
    const reports = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Weekly report</h1>
                <p className="text-muted-foreground text-sm">
                    {reports.length} report{reports.length === 1 ? "" : "s"} in
                    this workspace.
                </p>
            </div>

            <NewWeeklyReportForm />

            <ul className="flex flex-col gap-2">
                {reports.map((r) => (
                    <li key={r.id} className="rounded border px-3 py-2 text-sm">
                        <span className="font-medium">
                            {r.weekStart} → {r.weekEnd}
                        </span>
                        {r.sentAt ? " · sent" : " · draft"} ·{" "}
                        {r.highlights?.length ?? 0} highlight(s)
                    </li>
                ))}
            </ul>
        </main>
    )
}
