"use client"

import { useState, useTransition } from "react"
import { updateWorkspaceSettings } from "@/lib/domains/system/workspace"

/**
 * Workspace settings island (client). Posts name + timezone edits to the guarded
 * `updateWorkspaceSettings` server action and renders the returned envelope. The
 * action re-guards (admin-only) and validates with Zod, so this form's gating is
 * cosmetic.
 */
export function WorkspaceSettingsForm({
    name,
    timezone
}: {
    name: string
    timezone: string
}) {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onSubmit(formData: FormData) {
        const nextName = String(formData.get("name") ?? "")
        const nextTimezone = String(formData.get("timezone") ?? "")
        startTransition(async () => {
            const result = await updateWorkspaceSettings({
                name: nextName,
                timezone: nextTimezone || undefined
            })
            setMessage(
                result.status ? "Saved." : (result.message ?? "Failed to save.")
            )
        })
    }

    return (
        <form action={onSubmit} className="flex max-w-md flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
                Workspace name
                <input
                    type="text"
                    name="name"
                    defaultValue={name}
                    required
                    maxLength={120}
                    className="rounded border px-2 py-1"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm">
                Timezone
                <input
                    type="text"
                    name="timezone"
                    defaultValue={timezone}
                    placeholder="e.g. America/Los_Angeles"
                    maxLength={64}
                    className="rounded border px-2 py-1"
                />
            </label>
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Saving…" : "Save settings"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </form>
    )
}
