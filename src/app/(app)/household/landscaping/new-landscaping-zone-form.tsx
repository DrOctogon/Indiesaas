"use client"

import { useState, useTransition } from "react"
import { createLandscapingZone } from "@/lib/domains/household/landscaping"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createLandscapingZone` server action and renders the returned envelope.
 */
export function NewLandscapingZoneForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const name = String(formData.get("name") ?? "")
        const area = String(formData.get("area") ?? "")
        const irrigation = String(formData.get("irrigation") ?? "")

        startTransition(async () => {
            const result = await createLandscapingZone({
                name,
                area: area || undefined,
                irrigation: irrigation || undefined
            })
            setMessage(
                result.status ? "Saved." : (result.message ?? "Failed to save.")
            )
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Zone name
                <input
                    type="text"
                    name="name"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Area
                <input
                    type="text"
                    name="area"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Irrigation
                <input
                    type="text"
                    name="irrigation"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add zone"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
