import { listDailyLogs } from "@/lib/domains/care/daily-log"
import { requireAccess } from "@/lib/rbac/guards"
import { NewDailyLogForm } from "./new-daily-log-form"

/**
 * Daily-log page — the canonical M3 feature route. The view guard runs first
 * (fail-closed; an unauthorised role renders the forbidden state, never the
 * data). Data is read through the domain action, which re-guards and scopes to
 * the active workspace via the Repository. This server/action/repo layering is
 * what every feature area mirrors.
 */
export default async function DailyLogPage() {
    let caregiverId: string
    try {
        const ctx = await requireAccess("daily-log")
        caregiverId = ctx.userId
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Daily log</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to daily logs in this workspace.
                </p>
            </main>
        )
    }

    const result = await listDailyLogs()
    const logs = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Daily log</h1>
                <p className="text-muted-foreground text-sm">
                    {logs.length} entr{logs.length === 1 ? "y" : "ies"} in this
                    workspace.
                </p>
            </div>

            <NewDailyLogForm caregiverId={caregiverId} />

            <ul className="flex flex-col gap-2">
                {logs.map((log) => (
                    <li
                        key={log.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{log.date}</span>
                        {log.pain?.now != null ? ` · pain ${log.pain.now}` : ""}
                        {log.sleep?.hours != null
                            ? ` · sleep ${log.sleep.hours}h`
                            : ""}
                        {log.mood?.concernFlag ? " · ⚠ mood concern" : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
