import { listBudgetLines } from "@/lib/domains/ops/budget"
import { requireAccess } from "@/lib/rbac/guards"
import { NewBudgetLineForm } from "./new-budget-line-form"

/**
 * Budget page (Operations area) — ADMIN-ONLY. The view guard
 * `requireAccess("budget")` already fails closed for non-admins (budget has no
 * non-admin view access). Mirrors the canonical care/daily-log route.
 */
export default async function BudgetPage() {
    try {
        await requireAccess("budget")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Budget</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to budget in this workspace.
                </p>
            </main>
        )
    }

    const result = await listBudgetLines()
    const lines = result.status ? (result.data ?? []) : []
    const net = lines.reduce((sum, line) => {
        const actual = line.monthlyActual ?? 0
        return line.kind === "income" ? sum + actual : sum - actual
    }, 0)

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Budget</h1>
                <p className="text-muted-foreground text-sm">
                    {lines.length} line{lines.length === 1 ? "" : "s"} · monthly
                    net {net}
                </p>
            </div>

            <NewBudgetLineForm />

            <ul className="flex flex-col gap-2">
                {lines.map((line) => (
                    <li
                        key={line.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{line.category}</span> ·{" "}
                        {line.kind}
                        {line.monthlyActual != null
                            ? ` · ${line.monthlyActual}/mo`
                            : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
