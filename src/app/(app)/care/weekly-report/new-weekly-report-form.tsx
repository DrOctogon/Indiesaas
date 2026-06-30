"use client"

import { useState, useTransition } from "react"
import { createWeeklyReport } from "@/lib/domains/care/weekly-report"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createWeeklyReport` server action and renders the returned envelope.
 */
export function NewWeeklyReportForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const weekStart = String(formData.get("weekStart") ?? "")
        const weekEnd = String(formData.get("weekEnd") ?? "")
        const highlight = String(formData.get("highlight") ?? "").trim()

        startTransition(async () => {
            const result = await createWeeklyReport({
                weekStart,
                weekEnd,
                highlights: highlight ? [highlight] : []
            })
            setMessage(
                result.status ? "Saved." : (result.message ?? "Failed to save.")
            )
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Week start
                <input
                    type="date"
                    name="weekStart"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Week end
                <input
                    type="date"
                    name="weekEnd"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                First highlight (optional)
                <input
                    type="text"
                    name="highlight"
                    placeholder="e.g. Great week of sleep"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add report"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
