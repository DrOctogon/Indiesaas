import { listProperties } from "@/lib/domains/household/property"
import { requireAccess } from "@/lib/rbac/guards"
import { NewPropertyForm } from "./new-property-form"

/**
 * Property page — a Household feature route cloned from the canonical
 * care/daily-log page. The view guard runs first (fail-closed; an unauthorised
 * role renders the forbidden state, never the data). Data is read through the
 * domain action, which re-guards and scopes to the active workspace via the
 * Repository.
 */
export default async function PropertyPage() {
    try {
        await requireAccess("property")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Property</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to property in this workspace.
                </p>
            </main>
        )
    }

    const result = await listProperties()
    const properties = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Property</h1>
                <p className="text-muted-foreground text-sm">
                    {properties.length}{" "}
                    {properties.length === 1 ? "property" : "properties"} in
                    this workspace.
                </p>
            </div>

            <NewPropertyForm />

            <ul className="flex flex-col gap-2">
                {properties.map((property) => (
                    <li
                        key={property.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{property.name}</span>
                        {` · ${property.type}`}
                    </li>
                ))}
            </ul>
        </main>
    )
}
