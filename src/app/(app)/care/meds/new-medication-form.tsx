"use client"

import { useState, useTransition } from "react"
import { createMedication } from "@/lib/domains/care/meds"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createMedication` server action and renders the returned envelope. The times
 * field is split on commas into the `times` array.
 */
export function NewMedicationForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const recipientId = String(formData.get("recipientId") ?? "").trim()
        const name = String(formData.get("name") ?? "").trim()
        const dose = String(formData.get("dose") ?? "").trim()
        const frequency = String(formData.get("frequency") ?? "").trim()
        const times = String(formData.get("times") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)

        startTransition(async () => {
            const result = await createMedication({
                recipientId,
                name,
                dose,
                frequency,
                times,
                active: true
            })
            setMessage(
                result.status ? "Saved." : (result.message ?? "Failed to save.")
            )
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Recipient id
                <input
                    type="text"
                    name="recipientId"
                    required
                    placeholder="r-1"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Name
                <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Lisinopril"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Dose
                <input
                    type="text"
                    name="dose"
                    required
                    placeholder="e.g. 10mg"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Frequency
                <input
                    type="text"
                    name="frequency"
                    required
                    placeholder="e.g. once daily"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Times (comma-separated HH:mm)
                <input
                    type="text"
                    name="times"
                    placeholder="08:00, 20:00"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add medication"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
