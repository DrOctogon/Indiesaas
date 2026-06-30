"use client"

import { useState, useTransition } from "react"
import { createRecipient } from "@/lib/domains/life/recipients"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createRecipient` server action and renders whatever envelope comes back.
 * Comma-separated conditions/allergies are split into arrays at the boundary;
 * the server action re-validates with Zod.
 */
export function NewRecipientForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function splitList(raw: string): string[] {
        return raw
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0)
    }

    function onSubmit(formData: FormData) {
        const name = String(formData.get("name") ?? "")
        const dob = String(formData.get("dob") ?? "")
        const conditions = splitList(String(formData.get("conditions") ?? ""))
        const allergies = splitList(String(formData.get("allergies") ?? ""))

        startTransition(async () => {
            const result = await createRecipient({
                name,
                ...(dob ? { dob } : {}),
                conditions,
                allergies
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
                Date of birth
                <input
                    type="date"
                    name="dob"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Conditions (comma-separated)
                <input
                    type="text"
                    name="conditions"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Allergies (comma-separated)
                <input
                    type="text"
                    name="allergies"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add recipient"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
