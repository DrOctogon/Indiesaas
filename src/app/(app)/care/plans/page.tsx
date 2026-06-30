import { listCarePlans } from "@/lib/domains/care/plans"
import { requireAccess } from "@/lib/rbac/guards"
import { NewCarePlanForm } from "./new-care-plan-form"

/**
 * Care-plans page — clones the canonical daily-log route. View guard first
 * (fail-closed); data read through the guard-re-checking domain action, scoped
 * to the active workspace by the Repository.
 */
export default async function PlansPage() {
    try {
        await requireAccess("plans")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Care plans</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to care plans in this workspace.
                </p>
            </main>
        )
    }

    const result = await listCarePlans()
    const plans = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Care plans</h1>
                <p className="text-muted-foreground text-sm">
                    {plans.length} protocol{plans.length === 1 ? "" : "s"} in
                    this workspace.
                </p>
            </div>

            <NewCarePlanForm />

            <ul className="flex flex-col gap-2">
                {plans.map((p) => (
                    <li key={p.id} className="rounded border px-3 py-2 text-sm">
                        <span className="font-medium">{p.name}</span> ·{" "}
                        {p.category} · {p.steps?.length ?? 0} step(s)
                    </li>
                ))}
            </ul>
        </main>
    )
}
