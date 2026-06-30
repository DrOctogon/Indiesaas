"use client"

import { useState, useTransition } from "react"
import { createShiftChecklist } from "@/lib/domains/care/checklist"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createShiftChecklist` server action and renders the returned envelope. Seeds
 * a single "morning" section item so the create validates end-to-end.
 */
export function NewShiftChecklistForm({
    caregiverId
}: {
    caregiverId: string
}) {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const date = String(formData.get("date") ?? "")
        const firstTask = String(formData.get("firstTask") ?? "").trim()

        startTransition(async () => {
            const result = await createShiftChecklist({
                date,
                caregiverId,
                sections: {
                    morning: firstTask
                        ? [{ label: firstTask, done: false }]
                        : []
                }
            })
            setMessage(
                result.status ? "Saved." : (result.message ?? "Failed to save.")
            )
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Date
                <input
                    type="date"
                    name="date"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                First morning task
                <input
                    type="text"
                    name="firstTask"
                    placeholder="e.g. Morning meds"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add checklist"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
