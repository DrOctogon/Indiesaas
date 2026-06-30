"use client"

import { useEffect, useState, useTransition } from "react"
import { removeSubscription, saveSubscription } from "@/lib/notify/subscribe"

/**
 * Web Push subscribe UI. Registers `/sw.js`, requests Notification permission,
 * subscribes with the public VAPID key, and persists the subscription via the
 * `saveSubscription` server action (which stores it user-global, mirroring the
 * shape dispatch.ts reads back). Renders a disabled no-op state when push is
 * not configured server-side (`enabled` prop, resolved from `pushEnabled()`).
 */

interface PushSubscribeProps {
    /** Server-resolved `pushEnabled()` — false → push unconfigured, disable UI. */
    enabled: boolean
    /** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, passed from the server component. */
    vapidPublicKey: string
}

/** Decode a base64url VAPID key to the ArrayBuffer `subscribe` expects. */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4)
    const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
    const raw = atob(normalized)
    const buffer = new ArrayBuffer(raw.length)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < raw.length; i++) {
        view[i] = raw.charCodeAt(i)
    }
    return buffer
}

type Status = "unknown" | "unsupported" | "subscribed" | "unsubscribed"

export function PushSubscribe({ enabled, vapidPublicKey }: PushSubscribeProps) {
    const [status, setStatus] = useState<Status>("unknown")
    const [endpoint, setEndpoint] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    useEffect(() => {
        if (
            typeof navigator === "undefined" ||
            !("serviceWorker" in navigator) ||
            !("PushManager" in window)
        ) {
            setStatus("unsupported")
            return
        }
        navigator.serviceWorker.ready
            .then((reg) => reg.pushManager.getSubscription())
            .then((sub) => {
                if (sub) {
                    setEndpoint(sub.endpoint)
                    setStatus("subscribed")
                } else {
                    setStatus("unsubscribed")
                }
            })
            .catch(() => setStatus("unsubscribed"))
    }, [])

    function subscribe() {
        setMessage(null)
        startTransition(async () => {
            try {
                const permission = await Notification.requestPermission()
                if (permission !== "granted") {
                    setMessage("Notifications permission was not granted.")
                    return
                }
                const registration =
                    await navigator.serviceWorker.register("/sw.js")
                await navigator.serviceWorker.ready
                const sub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToBuffer(vapidPublicKey)
                })
                const json = sub.toJSON()
                const result = await saveSubscription({
                    endpoint: json.endpoint,
                    keys: json.keys,
                    userAgent: navigator.userAgent
                })
                if (result.status) {
                    setEndpoint(sub.endpoint)
                    setStatus("subscribed")
                    setMessage("Push notifications enabled.")
                } else {
                    setMessage(result.message ?? "Failed to subscribe.")
                }
            } catch {
                setMessage("Could not subscribe to push notifications.")
            }
        })
    }

    function unsubscribe() {
        setMessage(null)
        startTransition(async () => {
            try {
                const registration = await navigator.serviceWorker.ready
                const sub = await registration.pushManager.getSubscription()
                const current = sub?.endpoint ?? endpoint
                if (sub) {
                    await sub.unsubscribe()
                }
                if (current) {
                    await removeSubscription(current)
                }
                setEndpoint(null)
                setStatus("unsubscribed")
                setMessage("Push notifications disabled.")
            } catch {
                setMessage("Could not unsubscribe.")
            }
        })
    }

    if (!enabled) {
        return (
            <div className="rounded border px-3 py-2 text-muted-foreground text-sm">
                Web Push is not configured for this deployment.
            </div>
        )
    }

    if (status === "unsupported") {
        return (
            <div className="rounded border px-3 py-2 text-muted-foreground text-sm">
                This browser does not support Web Push notifications.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {status === "subscribed" ? (
                <button
                    type="button"
                    onClick={unsubscribe}
                    disabled={pending}
                    className="w-fit rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                    {pending ? "Working…" : "Disable push notifications"}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={subscribe}
                    disabled={pending || status === "unknown"}
                    className="w-fit rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                    {pending ? "Working…" : "Enable push notifications"}
                </button>
            )}
            {message ? <p className="text-sm">{message}</p> : null}
        </div>
    )
}
