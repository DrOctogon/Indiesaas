import {
    listLandscapingTasks,
    listLandscapingVendors,
    listLandscapingZones
} from "@/lib/domains/household/landscaping"
import { requireAccess } from "@/lib/rbac/guards"
import { NewLandscapingZoneForm } from "./new-landscaping-zone-form"

/**
 * Landscaping page — a Household feature route cloned from the canonical
 * care/daily-log page. View guard runs first (fail-closed); the three
 * landscaping collections (zones, tasks, vendors) are read through their domain
 * actions, each of which re-guards and scopes to the active workspace.
 */
export default async function LandscapingPage() {
    try {
        await requireAccess("landscaping")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Landscaping</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to landscaping in this workspace.
                </p>
            </main>
        )
    }

    const [zonesResult, tasksResult, vendorsResult] = await Promise.all([
        listLandscapingZones(),
        listLandscapingTasks(),
        listLandscapingVendors()
    ])
    const zones = zonesResult.status ? (zonesResult.data ?? []) : []
    const tasks = tasksResult.status ? (tasksResult.data ?? []) : []
    const vendors = vendorsResult.status ? (vendorsResult.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Landscaping</h1>
                <p className="text-muted-foreground text-sm">
                    {zones.length} zone{zones.length === 1 ? "" : "s"} ·{" "}
                    {tasks.length} task{tasks.length === 1 ? "" : "s"} ·{" "}
                    {vendors.length} vendor{vendors.length === 1 ? "" : "s"}.
                </p>
            </div>

            <NewLandscapingZoneForm />

            <section className="flex flex-col gap-2">
                <h2 className="font-medium text-sm">Zones</h2>
                <ul className="flex flex-col gap-2">
                    {zones.map((zone) => (
                        <li
                            key={zone.id}
                            className="rounded border px-3 py-2 text-sm"
                        >
                            <span className="font-medium">{zone.name}</span>
                            {zone.area ? ` · ${zone.area}` : ""}
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    )
}
