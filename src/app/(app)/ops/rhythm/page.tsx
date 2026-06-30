import { listOperatingRhythms } from "@/lib/domains/ops/rhythm"
import { requireAccess } from "@/lib/rbac/guards"
import { NewRhythmForm } from "./new-rhythm-form"

/**
 * Operating Rhythm page (Operations area). View guard runs first (fail-closed);
 * the domain action re-guards and scopes to the workspace. Mirrors the canonical
 * care/daily-log route.
 */
export default async function RhythmPage() {
    try {
        await requireAccess("rhythm")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Operating rhythm</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to operating rhythm in this workspace.
                </p>
            </main>
        )
    }

    const result = await listOperatingRhythms()
    const rhythms = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Operating rhythm</h1>
                <p className="text-muted-foreground text-sm">
                    {rhythms.length} cadence{rhythms.length === 1 ? "" : "s"} in
                    this workspace.
                </p>
            </div>

            <NewRhythmForm />

            <ul className="flex flex-col gap-2">
                {rhythms.map((rhythm) => (
                    <li
                        key={rhythm.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{rhythm.name}</span> ·{" "}
                        {rhythm.cadence}
                        {rhythm.owner ? ` · ${rhythm.owner}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
