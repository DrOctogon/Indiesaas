"use client"

import { useState, useTransition } from "react"
import { createProperty } from "@/lib/domains/household/property"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createProperty` server action and renders whatever envelope comes back.
 */
export function NewPropertyForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const name = String(formData.get("name") ?? "")
        const type = String(formData.get("type") ?? "")
        const notes = String(formData.get("notes") ?? "")

        startTransition(async () => {
            const result = await createProperty({
                name,
                type,
                notes: notes || undefined
            })
            setMessage(
                result.status ? "Saved." : (result.message ?? "Failed to save.")
            )
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
                Type
                <input
                    type="text"
                    name="type"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Notes
                <input
                    type="text"
                    name="notes"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add property"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
