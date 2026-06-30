import { listShiftChecklists } from "@/lib/domains/care/checklist"
import { requireAccess } from "@/lib/rbac/guards"
import { NewShiftChecklistForm } from "./new-shift-checklist-form"

/**
 * Shift-checklist page — clones the canonical daily-log route. The view guard
 * runs first (fail-closed); data is read through the guard-re-checking domain
 * action, scoped to the active workspace by the Repository.
 */
export default async function ChecklistPage() {
    let caregiverId: string
    try {
        const ctx = await requireAccess("checklist")
        caregiverId = ctx.userId
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Shift checklist</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to checklists in this workspace.
                </p>
            </main>
        )
    }

    const result = await listShiftChecklists()
    const checklists = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Shift checklist</h1>
                <p className="text-muted-foreground text-sm">
                    {checklists.length} checklist
                    {checklists.length === 1 ? "" : "s"} in this workspace.
                </p>
            </div>

            <NewShiftChecklistForm caregiverId={caregiverId} />

            <ul className="flex flex-col gap-2">
                {checklists.map((cl) => (
                    <li
                        key={cl.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{cl.date}</span>
                        {" · "}
                        {Object.keys(cl.sections ?? {}).length} section(s)
                    </li>
                ))}
            </ul>
        </main>
    )
}
