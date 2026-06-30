"use client"

import { useState, useTransition } from "react"
import { createDailyLog } from "@/lib/domains/care/daily-log"

/**
 * Minimal client form exercising the canonical write path: it calls the
 * `createDailyLog` server action and renders whatever envelope comes back,
 * including any escalation signals the pure engine raised. Feature areas clone
 * this shape (client form → server action → typed envelope).
 */
export function NewDailyLogForm({ caregiverId }: { caregiverId: string }) {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const date = String(formData.get("date") ?? "")
        const painNow = Number(formData.get("painNow") ?? 0)
        const sleepHours = Number(formData.get("sleepHours") ?? 0)

        startTransition(async () => {
            const result = await createDailyLog({
                date,
                caregiverId,
                pain: { now: painNow },
                sleep: { hours: sleepHours }
            })
            if (!result.status) {
                setMessage(result.message ?? "Failed to save.")
                return
            }
            const escalations = result.data?.escalations ?? []
            setMessage(
                escalations.length
                    ? `Saved. Escalations: ${escalations
                          .map((e) => e.detail)
                          .join(", ")}`
                    : "Saved."
            )
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Date
                <input
                    type="date"
                    name="date"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Pain now (0–10)
                <input
                    type="number"
                    name="painNow"
                    min={0}
                    max={10}
                    defaultValue={0}
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Sleep hours
                <input
                    type="number"
                    name="sleepHours"
                    min={0}
                    max={24}
                    step={0.5}
                    defaultValue={8}
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add daily log"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
