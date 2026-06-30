/**
 * Web Push channel (see BUILD/05 §push). VAPID-signed delivery to a member's
 * stored subscriptions, with dead-endpoint pruning (404/410). Gated on
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (+ optional
 * `VAPID_SUBJECT`); absent → no-op. The `web-push` package is imported lazily
 * and guarded, so the app compiles and runs even when it isn't installed.
 */

export interface PushSubscriptionRecord {
    endpoint: string
    keys: { p256dh: string; auth: string }
}

export interface PushPayload {
    title: string
    body: string
    url?: string
}

export interface PushResult {
    sent: number
    /** Endpoints that returned 404/410 and should be pruned by the caller. */
    deadEndpoints: string[]
}

/** Whether Web Push is configured (both VAPID keys present). */
export function pushEnabled(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
            process.env.VAPID_PRIVATE_KEY
    )
}

/** Build a push payload from an alert (title/body). */
export function buildPushPayload(alert: {
    level: string
    description: string
}): PushPayload {
    return {
        title: `HomeCare alert · ${alert.level}`,
        body: alert.description
    }
}

interface WebPushModule {
    setVapidDetails: (subject: string, pub: string, priv: string) => void
    sendNotification: (
        sub: PushSubscriptionRecord,
        payload: string
    ) => Promise<unknown>
}

let cached: WebPushModule | null = null

async function getWebPush(): Promise<WebPushModule | null> {
    if (!pushEnabled()) return null
    if (cached) return cached
    try {
        // Indirect the specifier so tsc treats it as a dynamic (any) import —
        // `web-push` is an optional peer dep that may not be installed.
        const spec: string = "web-push"
        const mod = (await import(spec)) as {
            default?: WebPushModule
        } & WebPushModule
        const webpush = mod.default ?? mod
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT ?? "mailto:notify@homecare.app",
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
            process.env.VAPID_PRIVATE_KEY as string
        )
        cached = webpush
        return cached
    } catch {
        // Package not installed / unavailable → treat as unconfigured.
        return null
    }
}

/**
 * Push `payload` to every subscription. Never throws. Returns the sent count and
 * the dead endpoints (404/410) the caller should prune from storage.
 */
export async function sendPush(
    subscriptions: readonly PushSubscriptionRecord[],
    payload: PushPayload
): Promise<PushResult> {
    const webpush = await getWebPush()
    if (!webpush || subscriptions.length === 0) {
        return { sent: 0, deadEndpoints: [] }
    }
    const body = JSON.stringify(payload)
    let sent = 0
    const deadEndpoints: string[] = []
    for (const sub of subscriptions) {
        try {
            await webpush.sendNotification(sub, body)
            sent++
        } catch (error) {
            const status = (error as { statusCode?: number }).statusCode
            if (status === 404 || status === 410) {
                deadEndpoints.push(sub.endpoint)
            } else {
                console.error("[notify/push] send failed", error)
            }
        }
    }
    return { sent, deadEndpoints }
}
