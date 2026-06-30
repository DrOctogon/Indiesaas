import { getCareTrends } from "@/lib/domains/care/trends"
import { requireAccess } from "@/lib/rbac/guards"

/**
 * Care-trends page — READ-ONLY (see BUILD/02 §Care Trends). View guard only
 * (`requireAccess("trends")`); there is NO write path and no form. The aggregate
 * is derived by the domain action from workspace-scoped dailyLogs + vitals.
 */
export default async function TrendsPage() {
    try {
        await requireAccess("trends")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Care trends</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to trends in this workspace.
                </p>
            </main>
        )
    }

    const result = await getCareTrends()
    const trends = result.status ? result.data : undefined
    const points = trends?.dailyLog ?? []
    const counts = trends?.counts

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Care trends</h1>
                <p className="text-muted-foreground text-sm">
                    {counts?.dailyLogs ?? 0} daily log(s) ·{" "}
                    {counts?.vitals ?? 0} vital(s) ·{" "}
                    {counts?.moodConcernDays ?? 0} mood-concern day(s) ·{" "}
                    {counts?.medMissedDays ?? 0} med-missed day(s).
                </p>
            </div>

            <ul className="flex flex-col gap-2">
                {points.map((p) => (
                    <li
                        key={p.date}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{p.date}</span>
                        {p.painNow != null ? ` · pain ${p.painNow}` : ""}
                        {p.sleepHours != null
                            ? ` · sleep ${p.sleepHours}h`
                            : ""}
                        {p.moodConcern ? " · ⚠ mood" : ""}
                        {p.medMissed ? " · ⚠ med missed" : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
