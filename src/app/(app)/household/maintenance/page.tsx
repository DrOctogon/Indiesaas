import { listMaintenanceTasks } from "@/lib/domains/household/maintenance"
import { requireAccess } from "@/lib/rbac/guards"
import { NewMaintenanceForm } from "./new-maintenance-form"

/**
 * Maintenance page — a Household feature route cloned from the canonical
 * care/daily-log page. View guard runs first (fail-closed); data is read
 * through the domain action, which re-guards and scopes to the workspace.
 */
export default async function MaintenancePage() {
    try {
        await requireAccess("maintenance")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Maintenance</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to maintenance in this workspace.
                </p>
            </main>
        )
    }

    const result = await listMaintenanceTasks()
    const tasks = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Maintenance</h1>
                <p className="text-muted-foreground text-sm">
                    {tasks.length} task{tasks.length === 1 ? "" : "s"} in this
                    workspace.
                </p>
            </div>

            <NewMaintenanceForm />

            <ul className="flex flex-col gap-2">
                {tasks.map((task) => (
                    <li
                        key={task.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{task.item}</span>
                        {` · ${task.cadence}`}
                        {task.nextDue ? ` · due ${task.nextDue}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
