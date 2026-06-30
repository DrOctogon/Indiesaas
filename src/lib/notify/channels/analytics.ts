/**
 * Server-side analytics channel (see BUILD/05 §analytics). Auth-only product
 * events, captured to PostHog via its HTTP capture API (no SDK dependency).
 * Gated on `NEXT_PUBLIC_POSTHOG_KEY` (+ optional `NEXT_PUBLIC_POSTHOG_HOST`);
 * absent → no-op. Never throws — analytics must never break a request.
 */

/** Whether analytics is configured. */
export function analyticsEnabled(): boolean {
    return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)
}

/**
 * Capture a product event for a known (authenticated) user. No-op when
 * unconfigured; swallows all errors.
 */
export async function capture(
    distinctId: string,
    event: string,
    properties: Record<string, unknown> = {}
): Promise<void> {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return
    const host =
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
    try {
        await fetch(`${host}/capture/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: key,
                event,
                distinct_id: distinctId,
                properties
            })
        })
    } catch (error) {
        console.error("[notify/analytics] capture failed", error)
    }
}
