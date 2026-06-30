/**
 * Transactional email channel (see BUILD/05 §email). A single
 * `sendEmail(to, subject, body)` that NEVER throws and returns a sent count.
 * Gated on `RESEND_API_KEY` + `EMAIL_FROM`; absent → no-op returning 0. The
 * core in-app notification loop must never break because email is unconfigured.
 */

let cachedClient: {
    emails: { send: (args: unknown) => Promise<unknown> }
} | null = null

async function getClient() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return null
    if (cachedClient) return cachedClient
    try {
        const { Resend } = await import("resend")
        cachedClient = new Resend(apiKey) as unknown as typeof cachedClient
        return cachedClient
    } catch {
        return null
    }
}

/**
 * Send a plain-text email. Returns 1 on a successful send, 0 on no-op or
 * failure. Never throws — failures are logged server-side and swallowed so a
 * mail outage can't break a domain mutation.
 */
export async function sendEmail(
    to: string,
    subject: string,
    body: string
): Promise<number> {
    const from = process.env.EMAIL_FROM
    if (!from) return 0
    const client = await getClient()
    if (!client) return 0
    try {
        await client.emails.send({ from, to, subject, text: body })
        return 1
    } catch (error) {
        console.error("[notify/email] send failed", error)
        return 0
    }
}

/** Whether email is configured (key + verified from address present). */
export function emailEnabled(): boolean {
    return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}
