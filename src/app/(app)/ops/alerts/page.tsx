import { listAlerts } from "@/lib/domains/ops/alerts"
import { requireAccess } from "@/lib/rbac/guards"
import { NewAlertForm } from "./new-alert-form"

/**
 * Alerts page (Operations area). View guard runs first (fail-closed). Data is
 * read through the domain action, which re-guards and scopes to the active
 * workspace. Mirrors the canonical care/daily-log route.
 */
export default async function AlertsPage() {
    try {
        await requireAccess("alerts")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Alerts</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to alerts in this workspace.
                </p>
            </main>
        )
    }

    const result = await listAlerts()
    const alerts = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Alerts</h1>
                <p className="text-muted-foreground text-sm">
                    {alerts.length} alert{alerts.length === 1 ? "" : "s"} in
                    this workspace.
                </p>
            </div>

            <NewAlertForm />

            <ul className="flex flex-col gap-2">
                {alerts.map((alert) => (
                    <li
                        key={alert.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{alert.level}</span> ·{" "}
                        {alert.category} — {alert.description}
                        {alert.status ? ` · ${alert.status}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
