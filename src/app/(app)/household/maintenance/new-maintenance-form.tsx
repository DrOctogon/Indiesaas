"use client"

import { useState, useTransition } from "react"
import { createMaintenanceTask } from "@/lib/domains/household/maintenance"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createMaintenanceTask` server action and renders the returned envelope.
 */
export function NewMaintenanceForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const item = String(formData.get("item") ?? "")
        const cadence = String(formData.get("cadence") ?? "")
        const nextDue = String(formData.get("nextDue") ?? "")

        startTransition(async () => {
            const result = await createMaintenanceTask({
                item,
                cadence,
                nextDue: nextDue || undefined
            })
            setMessage(
                result.status ? "Saved." : (result.message ?? "Failed to save.")
            )
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Item
                <input
                    type="text"
                    name="item"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Cadence
                <input
                    type="text"
                    name="cadence"
                    required
                    placeholder="e.g. quarterly"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Next due
                <input
                    type="date"
                    name="nextDue"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add task"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
