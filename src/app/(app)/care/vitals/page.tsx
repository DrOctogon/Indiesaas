import { listVitals } from "@/lib/domains/care/vitals"
import { requireAccess } from "@/lib/rbac/guards"
import { NewVitalForm } from "./new-vital-form"

/**
 * Vitals page — clones the canonical daily-log route. View guard first
 * (fail-closed); data read through the guard-re-checking domain action, scoped
 * to the active workspace by the Repository.
 */
export default async function VitalsPage() {
    try {
        await requireAccess("vitals")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Vitals</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to vitals in this workspace.
                </p>
            </main>
        )
    }

    const result = await listVitals()
    const vitals = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Vitals</h1>
                <p className="text-muted-foreground text-sm">
                    {vitals.length} reading{vitals.length === 1 ? "" : "s"} in
                    this workspace.
                </p>
            </div>

            <NewVitalForm />

            <ul className="flex flex-col gap-2">
                {vitals.map((v) => (
                    <li key={v.id} className="rounded border px-3 py-2 text-sm">
                        <span className="font-medium">{v.type}</span>
                        {" · "}
                        {v.value}
                        {v.value2 != null ? `/${v.value2}` : ""} {v.unit}
                        {" · "}
                        {v.takenAt}
                    </li>
                ))}
            </ul>
        </main>
    )
}
