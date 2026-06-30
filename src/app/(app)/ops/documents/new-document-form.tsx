"use client"

import { useState, useTransition } from "react"
import { createDocument } from "@/lib/domains/ops/documents"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createDocument` server action and renders the returned envelope.
 */
export function NewDocumentForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const docType = String(formData.get("docType") ?? "")
        const status = String(formData.get("status") ?? "need")
        const location = String(formData.get("location") ?? "")

        startTransition(async () => {
            const result = await createDocument({
                docType,
                status,
                ...(location ? { location } : {})
            })
            setMessage(result.status ? "Saved." : (result.message ?? "Failed."))
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Document type
                <input
                    type="text"
                    name="docType"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Status
                <select
                    name="status"
                    defaultValue="need"
                    className="rounded border px-2 py-1"
                >
                    <option value="need">need</option>
                    <option value="in-progress">in-progress</option>
                    <option value="have">have</option>
                    <option value="unknown">unknown</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Location
                <input
                    type="text"
                    name="location"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add document"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
