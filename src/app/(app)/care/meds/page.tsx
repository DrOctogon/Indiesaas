import { listMedications } from "@/lib/domains/care/meds"
import { requireAccess } from "@/lib/rbac/guards"
import { NewMedicationForm } from "./new-medication-form"

/**
 * Meds page — clones the canonical daily-log route. View guard first via the
 * `health` nav key (fail-closed); data read through the guard-re-checking
 * domain action, scoped to the active workspace by the Repository.
 */
export default async function MedsPage() {
    try {
        await requireAccess("health")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Medications</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to medications in this workspace.
                </p>
            </main>
        )
    }

    const result = await listMedications()
    const meds = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Medications</h1>
                <p className="text-muted-foreground text-sm">
                    {meds.length} medication{meds.length === 1 ? "" : "s"} in
                    this workspace.
                </p>
            </div>

            <NewMedicationForm />

            <ul className="flex flex-col gap-2">
                {meds.map((m) => (
                    <li key={m.id} className="rounded border px-3 py-2 text-sm">
                        <span className="font-medium">{m.name}</span> · {m.dose}{" "}
                        · {m.frequency}
                        {m.active ? "" : " · inactive"}
                    </li>
                ))}
            </ul>
        </main>
    )
}
