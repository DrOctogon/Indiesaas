"use client"

import { useState, useTransition } from "react"
import { createOperatingRhythm } from "@/lib/domains/ops/rhythm"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createOperatingRhythm` server action and renders the returned envelope.
 */
export function NewRhythmForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const name = String(formData.get("name") ?? "")
        const cadence = String(formData.get("cadence") ?? "weekly")
        const owner = String(formData.get("owner") ?? "")

        startTransition(async () => {
            const result = await createOperatingRhythm({
                name,
                cadence,
                ...(owner ? { owner } : {})
            })
            setMessage(result.status ? "Saved." : (result.message ?? "Failed."))
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Name
                <input
                    type="text"
                    name="name"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Cadence
                <select
                    name="cadence"
                    defaultValue="weekly"
                    className="rounded border px-2 py-1"
                >
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                    <option value="monthly">monthly</option>
                    <option value="quarterly">quarterly</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Owner
                <input
                    type="text"
                    name="owner"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add rhythm"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
