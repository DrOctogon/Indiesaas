"use client"

import { useState, useTransition } from "react"
import { createEvent } from "@/lib/domains/life/events"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createEvent` server action and renders whatever envelope comes back. Empty
 * optional fields are omitted so the server action's Zod schema treats them as
 * absent rather than empty strings.
 */
export function NewEventForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const title = String(formData.get("title") ?? "")
        const date = String(formData.get("date") ?? "")
        const type = String(formData.get("type") ?? "")
        const status = String(formData.get("status") ?? "")
        const guestCountRaw = String(formData.get("guestCount") ?? "")

        startTransition(async () => {
            const result = await createEvent({
                title,
                ...(date ? { date } : {}),
                ...(type ? { type } : {}),
                ...(status ? { status } : {}),
                ...(guestCountRaw ? { guestCount: Number(guestCountRaw) } : {})
            })
            setMessage(
                result.status ? "Saved." : (result.message ?? "Failed to save.")
            )
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Title
                <input
                    type="text"
                    name="title"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Date
                <input
                    type="date"
                    name="date"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Type
                <select name="type" className="rounded border px-2 py-1">
                    <option value="">—</option>
                    <option value="intimate-family-dinner">
                        Intimate family dinner
                    </option>
                    <option value="small-social">Small social</option>
                    <option value="holiday-gathering">Holiday gathering</option>
                    <option value="larger-party">Larger party</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Status
                <select name="status" className="rounded border px-2 py-1">
                    <option value="">—</option>
                    <option value="planning">Planning</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="complete">Complete</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Guest count
                <input
                    type="number"
                    name="guestCount"
                    min={0}
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add event"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
