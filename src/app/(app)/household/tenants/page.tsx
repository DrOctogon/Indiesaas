import { listGuestStays, listTenants } from "@/lib/domains/household/tenants"
import { requireAccess } from "@/lib/rbac/guards"
import { NewTenantForm } from "./new-tenant-form"

/**
 * Tenants page — an ADMIN-ONLY Household feature route cloned from the
 * canonical care/daily-log page. The view guard runs first: `tenants` is
 * admin-only in the RBAC view matrix, so `requireAccess("tenants")` already
 * fails closed for non-admins. Writes (in the domain actions) are additionally
 * gated by `requireManage("tenants", ["admin"])`.
 */
export default async function TenantsPage() {
    try {
        await requireAccess("tenants")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Tenants</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to tenants in this workspace.
                </p>
            </main>
        )
    }

    const [tenantsResult, staysResult] = await Promise.all([
        listTenants(),
        listGuestStays()
    ])
    const tenants = tenantsResult.status ? (tenantsResult.data ?? []) : []
    const stays = staysResult.status ? (staysResult.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Tenants</h1>
                <p className="text-muted-foreground text-sm">
                    {tenants.length} tenant{tenants.length === 1 ? "" : "s"} ·{" "}
                    {stays.length} guest stay{stays.length === 1 ? "" : "s"}.
                </p>
            </div>

            <NewTenantForm />

            <section className="flex flex-col gap-2">
                <h2 className="font-medium text-sm">Tenants</h2>
                <ul className="flex flex-col gap-2">
                    {tenants.map((tenant) => (
                        <li
                            key={tenant.id}
                            className="rounded border px-3 py-2 text-sm"
                        >
                            <span className="font-medium">{tenant.unit}</span>
                            {tenant.name ? ` · ${tenant.name}` : ""}
                            {tenant.rent != null
                                ? ` · rent ${tenant.rent}`
                                : ""}
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    )
}
