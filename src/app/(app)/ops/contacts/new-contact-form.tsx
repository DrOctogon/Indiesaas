"use client"

import { useState, useTransition } from "react"
import { createContact } from "@/lib/domains/ops/contacts"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createContact` server action and renders the returned envelope.
 */
export function NewContactForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const name = String(formData.get("name") ?? "")
        const category = String(formData.get("category") ?? "FAMILY")
        const phone = String(formData.get("phone") ?? "")

        startTransition(async () => {
            const result = await createContact({
                name,
                category,
                ...(phone ? { phone } : {}),
                visibility: "shared"
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
                Category
                <select
                    name="category"
                    defaultValue="FAMILY"
                    className="rounded border px-2 py-1"
                >
                    <option value="EMERGENCY">EMERGENCY</option>
                    <option value="FAMILY">FAMILY</option>
                    <option value="MEDICAL">MEDICAL</option>
                    <option value="CARE_TEAM">CARE_TEAM</option>
                    <option value="HOUSEHOLD">HOUSEHOLD</option>
                    <option value="PROFESSIONAL">PROFESSIONAL</option>
                    <option value="UTILITIES">UTILITIES</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Phone
                <input
                    type="text"
                    name="phone"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add contact"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
