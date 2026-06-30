"use client"

import { useState, useTransition } from "react"
import { createActionItem } from "@/lib/domains/ops/action-items"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createActionItem` server action and renders the returned envelope.
 */
export function NewActionItemForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const description = String(formData.get("description") ?? "")
        const priority = String(formData.get("priority") ?? "Med")
        const tag = String(formData.get("tag") ?? "")

        startTransition(async () => {
            const result = await createActionItem({
                openedDate: new Date().toISOString().slice(0, 10),
                description,
                priority,
                status: "Open",
                ...(tag ? { tag } : {})
            })
            setMessage(result.status ? "Saved." : (result.message ?? "Failed."))
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Description
                <input
                    type="text"
                    name="description"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Priority
                <select
                    name="priority"
                    defaultValue="Med"
                    className="rounded border px-2 py-1"
                >
                    <option value="High">High</option>
                    <option value="Med">Med</option>
                    <option value="Low">Low</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Tag
                <select name="tag" className="rounded border px-2 py-1">
                    <option value="">(none)</option>
                    <option value="care">care</option>
                    <option value="household">household</option>
                    <option value="family">family</option>
                    <option value="admin">admin</option>
                    <option value="finance">finance</option>
                </select>
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add action item"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
