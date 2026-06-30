import { listCareTasks, listOverdueCareTasks } from "@/lib/domains/care/tasks"
import { requireAccess } from "@/lib/rbac/guards"
import { NewCareTaskForm } from "./new-care-task-form"

/**
 * Care-tasks page — clones the canonical daily-log route. View guard first
 * (fail-closed). The "overdue" section is derived by the pure overdue engine
 * (now + workspace timezone injected in the domain action), shown alongside the
 * full task list.
 */
export default async function TasksPage() {
    try {
        await requireAccess("tasks")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Care tasks</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to tasks in this workspace.
                </p>
            </main>
        )
    }

    const [allResult, overdueResult] = await Promise.all([
        listCareTasks(),
        listOverdueCareTasks()
    ])
    const tasks = allResult.status ? (allResult.data ?? []) : []
    const overdue = overdueResult.status ? (overdueResult.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Care tasks</h1>
                <p className="text-muted-foreground text-sm">
                    {tasks.length} task{tasks.length === 1 ? "" : "s"} ·{" "}
                    {overdue.length} overdue.
                </p>
            </div>

            <NewCareTaskForm />

            {overdue.length > 0 ? (
                <section className="flex flex-col gap-2">
                    <h2 className="font-medium text-sm">Overdue</h2>
                    <ul className="flex flex-col gap-2">
                        {overdue.map((t) => (
                            <li
                                key={t.id}
                                className="rounded border border-red-300 px-3 py-2 text-sm"
                            >
                                ⚠ <span className="font-medium">{t.label}</span>
                                {t.date ? ` · due ${t.date}` : ""}
                                {t.time ? ` ${t.time}` : ""}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <ul className="flex flex-col gap-2">
                {tasks.map((t) => (
                    <li key={t.id} className="rounded border px-3 py-2 text-sm">
                        {t.doneAt ? "☑" : "☐"}{" "}
                        <span className="font-medium">{t.label}</span> ·{" "}
                        {t.category} · {t.recurrence}
                        {t.date ? ` · ${t.date}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
