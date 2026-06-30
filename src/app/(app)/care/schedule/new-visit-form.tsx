"use client"

import { useState, useTransition } from "react"
import { createVisit } from "@/lib/domains/care/schedule"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createVisit` server action and renders the returned envelope. The two
 * datetime-local inputs are converted to ISO datetimes.
 */
export function NewVisitForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const recipientId = String(formData.get("recipientId") ?? "").trim()
        const title = String(formData.get("title") ?? "").trim()
        const type = String(formData.get("type") ?? "other")
        const start = String(formData.get("start") ?? "")
        const end = String(formData.get("end") ?? "")

        startTransition(async () => {
            const result = await createVisit({
                recipientId,
                title,
                type,
                start: start ? new Date(start).toISOString() : "",
                end: end ? new Date(end).toISOString() : ""
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
                Title
                <input
                    type="text"
                    name="title"
                    required
                    placeholder="e.g. PCP follow-up"
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Type
                <select name="type" className="rounded border px-2 py-1">
                    <option value="doctor">doctor</option>
                    <option value="therapy">therapy</option>
                    <option value="caregiver">caregiver</option>
                    <option value="other">other</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Start
                <input
                    type="datetime-local"
                    name="start"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                End
                <input
                    type="datetime-local"
                    name="end"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add visit"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
