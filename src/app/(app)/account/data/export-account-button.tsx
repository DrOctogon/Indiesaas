"use client"

import { useState, useTransition } from "react"
import { exportMyAccountData } from "@/lib/domains/system/export"

/**
 * Account-data export island (client). Calls the guarded `exportMyAccountData`
 * server action (which re-guards and reads only the signed-in user's own rows),
 * then triggers a client-side download of the returned JSON. No data is
 * persisted to the page; the blob is created and revoked in the click handler.
 */
export function ExportAccountDataButton() {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onClick() {
        startTransition(async () => {
            const result = await exportMyAccountData()
            if (!result.status || !result.data) {
                setMessage(result.message ?? "Export failed.")
                return
            }

            const blob = new Blob([JSON.stringify(result.data, null, 2)], {
                type: "application/json"
            })
            const url = URL.createObjectURL(blob)
            const date = new Date().toISOString().slice(0, 10)
            const anchor = document.createElement("a")
            anchor.href = url
            anchor.download = `account-export-${date}.json`
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            URL.revokeObjectURL(url)
            setMessage("Export downloaded.")
        })
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                type="button"
                onClick={onClick}
                disabled={pending}
                className="w-fit rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
                {pending ? "Preparing…" : "Download my data"}
            </button>
            {message ? <p className="text-sm">{message}</p> : null}
        </div>
    )
}
