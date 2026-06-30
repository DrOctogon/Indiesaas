import {
    listUpcomingVisits,
    listVisitConflicts,
    listVisits
} from "@/lib/domains/care/schedule"
import { requireAccess } from "@/lib/rbac/guards"
import { NewVisitForm } from "./new-visit-form"

/**
 * Schedule page — clones the canonical daily-log route. View guard first
 * (open to caregiver+family). Conflicts + upcoming are derived by the pure
 * scheduling engine (now injected in the domain actions).
 */
export default async function SchedulePage() {
    try {
        await requireAccess("schedule")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Schedule</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to the schedule in this workspace.
                </p>
            </main>
        )
    }

    const [visitsResult, conflictsResult, upcomingResult] = await Promise.all([
        listVisits(),
        listVisitConflicts(),
        listUpcomingVisits()
    ])
    const visits = visitsResult.status ? (visitsResult.data ?? []) : []
    const conflicts = conflictsResult.status ? (conflictsResult.data ?? []) : []
    const upcoming = upcomingResult.status ? (upcomingResult.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Schedule</h1>
                <p className="text-muted-foreground text-sm">
                    {visits.length} visit{visits.length === 1 ? "" : "s"} ·{" "}
                    {upcoming.length} upcoming · {conflicts.length} conflict(s).
                </p>
            </div>

            <NewVisitForm />

            {conflicts.length > 0 ? (
                <section className="flex flex-col gap-2">
                    <h2 className="font-medium text-sm">Conflicts</h2>
                    <ul className="flex flex-col gap-2">
                        {conflicts.map(([a, b]) => (
                            <li
                                key={`${a.id}-${b.id}`}
                                className="rounded border border-red-300 px-3 py-2 text-sm"
                            >
                                ⚠ {a.title} ↔ {b.title}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <ul className="flex flex-col gap-2">
                {visits.map((v) => (
                    <li key={v.id} className="rounded border px-3 py-2 text-sm">
                        <span className="font-medium">{v.title}</span> ·{" "}
                        {v.type} · {v.start} → {v.end}
                    </li>
                ))}
            </ul>
        </main>
    )
}
