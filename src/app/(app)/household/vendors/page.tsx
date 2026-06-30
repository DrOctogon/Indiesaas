import { listVendors } from "@/lib/domains/household/vendors"
import { requireAccess } from "@/lib/rbac/guards"
import { NewVendorForm } from "./new-vendor-form"

/**
 * Vendors page — a Household feature route cloned from the canonical
 * care/daily-log page. View guard runs first (fail-closed); data is read
 * through the domain action, which re-guards and scopes to the workspace.
 */
export default async function VendorsPage() {
    try {
        await requireAccess("vendors")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Vendors</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to vendors in this workspace.
                </p>
            </main>
        )
    }

    const result = await listVendors()
    const vendors = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Vendors</h1>
                <p className="text-muted-foreground text-sm">
                    {vendors.length} vendor{vendors.length === 1 ? "" : "s"} in
                    this workspace.
                </p>
            </div>

            <NewVendorForm />

            <ul className="flex flex-col gap-2">
                {vendors.map((vendor) => (
                    <li
                        key={vendor.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{vendor.name}</span>
                        {` · ${vendor.service}`}
                        {vendor.phone ? ` · ${vendor.phone}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
