import { listActionItems } from "@/lib/domains/ops/action-items"
import { requireAccess } from "@/lib/rbac/guards"
import { NewActionItemForm } from "./new-action-item-form"

/**
 * Action Items page (Operations area). View guard runs first (fail-closed); the
 * domain action re-guards, scopes to the workspace, and tag-filters rows by
 * role. Mirrors the canonical care/daily-log route.
 */
export default async function ActionItemsPage() {
    try {
        await requireAccess("action-items")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Action items</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to action items in this workspace.
                </p>
            </main>
        )
    }

    const result = await listActionItems()
    const items = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Action items</h1>
                <p className="text-muted-foreground text-sm">
                    {items.length} item{items.length === 1 ? "" : "s"} visible
                    to you.
                </p>
            </div>

            <NewActionItemForm />

            <ul className="flex flex-col gap-2">
                {items.map((item) => (
                    <li
                        key={item.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{item.priority}</span> ·{" "}
                        {item.description} · {item.status}
                        {item.tag ? ` · #${item.tag}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
