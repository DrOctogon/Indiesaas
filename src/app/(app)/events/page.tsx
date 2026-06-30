import { listEvents } from "@/lib/domains/life/events"
import { requireAccess } from "@/lib/rbac/guards"
import { NewEventForm } from "./new-event-form"

/**
 * Events page — clones the canonical M3 feature route. The view guard runs first
 * (fail-closed; an unauthorised role renders the forbidden state, never the
 * data). Data is read through the domain action, which re-guards and scopes to
 * the active workspace via the Repository.
 */
export default async function EventsPage() {
    try {
        await requireAccess("events")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Events</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to events in this workspace.
                </p>
            </main>
        )
    }

    const result = await listEvents()
    const events = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Events</h1>
                <p className="text-muted-foreground text-sm">
                    {events.length} event{events.length === 1 ? "" : "s"} in
                    this workspace.
                </p>
            </div>

            <NewEventForm />

            <ul className="flex flex-col gap-2">
                {events.map((event) => (
                    <li
                        key={event.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{event.title}</span>
                        {event.date ? ` · ${event.date}` : ""}
                        {event.status ? ` · ${event.status}` : ""}
                        {event.guestCount != null
                            ? ` · ${event.guestCount} guests`
                            : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
