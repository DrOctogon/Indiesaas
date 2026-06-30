import { listCareGoals } from "@/lib/domains/care/goals"
import { requireAccess } from "@/lib/rbac/guards"
import { NewCareGoalForm } from "./new-care-goal-form"

/**
 * Care-goals page — clones the canonical daily-log route. View guard first
 * (open to caregiver+family); data read through the guard-re-checking domain
 * action, scoped to the active workspace by the Repository.
 */
export default async function GoalsPage() {
    try {
        await requireAccess("goals")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Care goals</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to goals in this workspace.
                </p>
            </main>
        )
    }

    const result = await listCareGoals()
    const goals = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Care goals</h1>
                <p className="text-muted-foreground text-sm">
                    {goals.length} goal{goals.length === 1 ? "" : "s"} in this
                    workspace.
                </p>
            </div>

            <NewCareGoalForm />

            <ul className="flex flex-col gap-2">
                {goals.map((g) => (
                    <li key={g.id} className="rounded border px-3 py-2 text-sm">
                        {g.done ? "☑" : "☐"}{" "}
                        <span className="font-medium">{g.label}</span>
                        {g.code ? ` · ${g.code}` : ""}
                        {g.trend ? ` · trend ${g.trend}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
