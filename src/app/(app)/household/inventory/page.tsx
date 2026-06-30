import { listInventory } from "@/lib/domains/household/inventory"
import { requireAccess } from "@/lib/rbac/guards"
import { NewInventoryForm } from "./new-inventory-form"

/**
 * Inventory page — a Household feature route cloned from the canonical
 * care/daily-log page. View guard runs first (fail-closed); data is read
 * through the domain action, which re-guards and scopes to the workspace.
 */
export default async function InventoryPage() {
    try {
        await requireAccess("inventory")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Inventory</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to inventory in this workspace.
                </p>
            </main>
        )
    }

    const result = await listInventory()
    const items = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Inventory</h1>
                <p className="text-muted-foreground text-sm">
                    {items.length} item{items.length === 1 ? "" : "s"} in this
                    workspace.
                </p>
            </div>

            <NewInventoryForm />

            <ul className="flex flex-col gap-2">
                {items.map((item) => (
                    <li
                        key={item.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{item.name}</span>
                        {item.location ? ` · ${item.location}` : ""}
                        {item.qty != null ? ` · qty ${item.qty}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
