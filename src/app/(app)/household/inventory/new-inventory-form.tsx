"use client"

import { useState, useTransition } from "react"
import { createInventoryItem } from "@/lib/domains/household/inventory"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createInventoryItem` server action and renders the returned envelope.
 */
export function NewInventoryForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const name = String(formData.get("name") ?? "")
        const location = String(formData.get("location") ?? "")
        const qtyRaw = String(formData.get("qty") ?? "")
        const qty = qtyRaw === "" ? undefined : Number(qtyRaw)

        startTransition(async () => {
            const result = await createInventoryItem({
                name,
                location: location || undefined,
                qty
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
                Location
                <input
                    type="text"
                    name="location"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Quantity
                <input
                    type="number"
                    name="qty"
                    min={0}
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add item"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
