"use client"

import { useState, useTransition } from "react"
import { deleteWorkspaceData } from "@/lib/domains/system/delete"

/**
 * Destructive-delete island (client). Requires the admin to type the workspace
 * name; the typed value is posted to the guarded `deleteWorkspaceData` server
 * action, which re-guards (admin-only) and re-checks the confirmation against
 * the real workspace name before deleting anything. The submit button stays
 * disabled until the typed name matches exactly — a deliberate friction so this
 * is never a one-click mass delete.
 */
export function DeleteWorkspaceDataForm({
    workspaceName
}: {
    workspaceName: string
}) {
    const [pending, startTransition] = useTransition()
    const [confirmation, setConfirmation] = useState("")
    const [message, setMessage] = useState<string | null>(null)

    const matches = confirmation.trim() === workspaceName

    function onSubmit(formData: FormData) {
        const typed = String(formData.get("confirmation") ?? "")
        startTransition(async () => {
            const result = await deleteWorkspaceData({ confirmation: typed })
            if (result.status) {
                setConfirmation("")
                setMessage(
                    `Deleted ${result.data?.totalDeleted ?? 0} row(s). This workspace’s data has been erased.`
                )
            } else {
                setMessage(result.message ?? "Delete failed.")
            }
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-md flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Type <strong>{workspaceName}</strong> to confirm
                <input
                    type="text"
                    name="confirmation"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    autoComplete="off"
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending || !matches}
                className="w-fit rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Deleting…" : "Permanently delete all data"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
