import { type NextRequest, NextResponse } from "next/server"
import { runVisitReminders } from "@/lib/notify/reminders"

/**
 * Scheduled invoker for the visit-reminder sweep (see BUILD/05 §scheduling
 * reminders). Vercel Cron hits this GET endpoint on the schedule in
 * `vercel.json`, sending an `Authorization: Bearer ${CRON_SECRET}` header
 * automatically when the `CRON_SECRET` env var is set. We reject any request
 * whose bearer token does not match, so the endpoint is not publicly
 * triggerable.
 *
 * The sweep itself (`runVisitReminders`) never throws and dedupes each (visit,
 * member) pair, so a missing mail provider or one bad row degrades to a no-op
 * rather than a 500 or duplicate reminders.
 */

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest): Promise<Response> {
    const secret = process.env.CRON_SECRET
    if (!secret) {
        return NextResponse.json(
            { error: "CRON_SECRET not configured" },
            { status: 503 }
        )
    }

    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await runVisitReminders(new Date())
    return NextResponse.json({ ok: true, ...result })
}
