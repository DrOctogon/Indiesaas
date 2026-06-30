"use client"

import { useState, useTransition } from "react"
import { createCareTask } from "@/lib/domains/care/tasks"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createCareTask` server action and renders the returned envelope.
 */
export function NewCareTaskForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const recipientId = String(formData.get("recipientId") ?? "").trim()
        const label = String(formData.get("label") ?? "").trim()
        const category = String(formData.get("category") ?? "other")
        const recurrence = String(formData.get("recurrence") ?? "once")
        const date = String(formData.get("date") ?? "").trim()

        startTransition(async () => {
            const result = await createCareTask({
                recipientId,
                label,
                category,
                recurrence,
                ...(date ? { date } : {})
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
                    placeholder="e.g. Morning meds"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Category
                <select name="category" className="rounded border px-2 py-1">
                    <option value="meds">meds</option>
                    <option value="meal">meal</option>
                    <option value="hygiene">hygiene</option>
                    <option value="exercise">exercise</option>
                    <option value="other">other</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Recurrence
                <select name="recurrence" className="rounded border px-2 py-1">
                    <option value="once">once</option>
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Due date (optional)
                <input
                    type="date"
                    name="date"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add task"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
