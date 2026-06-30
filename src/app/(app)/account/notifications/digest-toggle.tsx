"use client"

import { useState, useTransition } from "react"
import { setDigestPreference } from "./digest-actions"

/**
 * Daily-digest opt-in toggle. Calls the `setDigestPreference` server action
 * (which upserts the user-global `accountPreferences.dailyDigest` flag) and
 * reflects the returned envelope. Initial state is server-resolved via the
 * `initialEnabled` prop.
 */

interface DigestToggleProps {
    initialEnabled: boolean
}

export function DigestToggle({ initialEnabled }: DigestToggleProps) {
    const [enabled, setEnabled] = useState(initialEnabled)
    const [message, setMessage] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    function toggle(next: boolean) {
        setMessage(null)
        startTransition(async () => {
            const result = await setDigestPreference(next)
            if (result.status) {
                setEnabled(result.data ?? next)
                setMessage("Saved.")
            } else {
                setMessage(result.message ?? "Failed to save.")
            }
        })
    }

    return (
        <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={enabled}
                    disabled={pending}
                    onChange={(e) => toggle(e.target.checked)}
                    className="h-4 w-4"
                />
                Email me a daily digest of overdue tasks and open alerts
            </label>
            {message ? (
                <p className="text-muted-foreground text-sm">{message}</p>
            ) : null}
        </div>
    )
}
