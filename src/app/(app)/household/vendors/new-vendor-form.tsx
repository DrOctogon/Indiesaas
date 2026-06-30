"use client"

import { useState, useTransition } from "react"
import { createVendor } from "@/lib/domains/household/vendors"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createVendor` server action and renders the returned envelope.
 */
export function NewVendorForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const name = String(formData.get("name") ?? "")
        const service = String(formData.get("service") ?? "")
        const phone = String(formData.get("phone") ?? "")

        startTransition(async () => {
            const result = await createVendor({
                name,
                service,
                phone: phone || undefined
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
                Service
                <input
                    type="text"
                    name="service"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Phone
                <input
                    type="tel"
                    name="phone"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add vendor"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
