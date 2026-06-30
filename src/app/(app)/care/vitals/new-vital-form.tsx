"use client"

import { useState, useTransition } from "react"
import { createVital } from "@/lib/domains/care/vitals"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createVital` server action and renders the returned envelope.
 */
export function NewVitalForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const recipientId = String(formData.get("recipientId") ?? "").trim()
        const type = String(formData.get("type") ?? "hr")
        const value = Number(formData.get("value") ?? 0)
        const unit = String(formData.get("unit") ?? "").trim()

        startTransition(async () => {
            const result = await createVital({
                recipientId,
                type,
                value,
                unit,
                takenAt: new Date().toISOString()
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
                Type
                <select name="type" className="rounded border px-2 py-1">
                    <option value="bp">bp</option>
                    <option value="glucose">glucose</option>
                    <option value="weight">weight</option>
                    <option value="hr">hr</option>
                    <option value="temp">temp</option>
                    <option value="spo2">spo2</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Value
                <input
                    type="number"
                    name="value"
                    step="any"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Unit
                <input
                    type="text"
                    name="unit"
                    required
                    placeholder="bpm"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add vital"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
