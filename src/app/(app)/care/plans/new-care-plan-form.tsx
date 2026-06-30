"use client"

import { useState, useTransition } from "react"
import { createCarePlan } from "@/lib/domains/care/plans"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createCarePlan` server action and renders the returned envelope. The steps
 * textarea is split on newlines into the `steps` array.
 */
export function NewCarePlanForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const name = String(formData.get("name") ?? "").trim()
        const category = String(formData.get("category") ?? "").trim()
        const steps = String(formData.get("steps") ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)

        startTransition(async () => {
            const result = await createCarePlan({ name, category, steps })
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
                    placeholder="e.g. Fall prevention"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Category
                <input
                    type="text"
                    name="category"
                    required
                    placeholder="e.g. safety"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Steps (one per line)
                <textarea
                    name="steps"
                    rows={3}
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add plan"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
