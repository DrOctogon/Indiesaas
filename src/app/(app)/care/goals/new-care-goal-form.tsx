"use client"

import { useState, useTransition } from "react"
import { createCareGoal } from "@/lib/domains/care/goals"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createCareGoal` server action and renders the returned envelope.
 */
export function NewCareGoalForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const recipientId = String(formData.get("recipientId") ?? "").trim()
        const label = String(formData.get("label") ?? "").trim()
        const code = String(formData.get("code") ?? "").trim()

        startTransition(async () => {
            const result = await createCareGoal({
                recipientId,
                label,
                done: false,
                ...(code ? { code } : {})
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
                Label
                <input
                    type="text"
                    name="label"
                    required
                    placeholder="e.g. Social connection"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Code (G1–G8, optional)
                <input
                    type="text"
                    name="code"
                    placeholder="G2"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add goal"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
