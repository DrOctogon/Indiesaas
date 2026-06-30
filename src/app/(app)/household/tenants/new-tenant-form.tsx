"use client"

import { useState, useTransition } from "react"
import { createTenant } from "@/lib/domains/household/tenants"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createTenant` server action (admin-only; gated server-side) and renders the
 * returned envelope.
 */
export function NewTenantForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const unit = String(formData.get("unit") ?? "")
        const name = String(formData.get("name") ?? "")
        const rentRaw = String(formData.get("rent") ?? "")
        const rent = rentRaw === "" ? undefined : Number(rentRaw)

        startTransition(async () => {
            const result = await createTenant({
                unit,
                name: name || undefined,
                rent
            })
            setMessage(
                result.status ? "Saved." : (result.message ?? "Failed to save.")
            )
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Unit
                <input
                    type="text"
                    name="unit"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Name
                <input
                    type="text"
                    name="name"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Rent
                <input
                    type="number"
                    name="rent"
                    min={0}
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add tenant"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
