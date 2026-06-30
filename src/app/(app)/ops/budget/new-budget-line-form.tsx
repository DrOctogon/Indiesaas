"use client"

import { useState, useTransition } from "react"
import { createBudgetLine } from "@/lib/domains/ops/budget"

/**
 * Minimal client form exercising the canonical write path: calls the
 * `createBudgetLine` server action and renders the returned envelope.
 */
export function NewBudgetLineForm() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const category = String(formData.get("category") ?? "")
        const kind = String(formData.get("kind") ?? "expense")
        const monthlyActualRaw = String(formData.get("monthlyActual") ?? "")
        const monthlyActual = monthlyActualRaw
            ? Number(monthlyActualRaw)
            : undefined

        startTransition(async () => {
            const result = await createBudgetLine({
                category,
                kind,
                ...(monthlyActual != null ? { monthlyActual } : {})
            })
            setMessage(result.status ? "Saved." : (result.message ?? "Failed."))
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Category
                <input
                    type="text"
                    name="category"
                    required
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Kind
                <select
                    name="kind"
                    defaultValue="expense"
                    className="rounded border px-2 py-1"
                >
                    <option value="expense">expense</option>
                    <option value="income">income</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Monthly actual
                <input
                    type="number"
                    name="monthlyActual"
                    step="0.01"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Add budget line"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
