import Link from "next/link"
import { listMedications } from "@/lib/domains/care/meds"
import { listVisits } from "@/lib/domains/care/schedule"
import { listOverdueCareTasks } from "@/lib/domains/care/tasks"
import { listMaintenanceTasks } from "@/lib/domains/household/maintenance"
import { listEvents } from "@/lib/domains/life/events"
import { listActionItems } from "@/lib/domains/ops/action-items"
import { listAlerts } from "@/lib/domains/ops/alerts"
import { listBudgetLines } from "@/lib/domains/ops/budget"
import type { ActionResult } from "@/lib/domains/result"
import { requireWorkspace } from "@/lib/rbac/guards"
import { type NavKey, can } from "@/lib/rbac/matrix"

/**
 * Role-aware Dashboard (BUILD/02 §Dashboard — feature #1). A read-only KPI
 * landing that summarises the whole care + estate operation. Every card is
 * gated by the view matrix `can(role, navKey)` — a role only sees the KPIs it
 * may view — and each aggregate read is wrapped so one failing/forbidden domain
 * never breaks the page. The underlying list actions each re-guard server-side,
 * so this is defence-in-depth, not the sole gate.
 */

/** Safely resolve a list action to its rows, or null when the role can't view it. */
async function rows<T>(
    allowed: boolean,
    action: () => Promise<ActionResult<T[]>>
): Promise<T[] | null> {
    if (!allowed) return null
    try {
        const result = await action()
        return result.status ? (result.data ?? []) : []
    } catch {
        return null
    }
}

function Card({
    label,
    value,
    href
}: {
    label: string
    value: string
    href: string
}) {
    return (
        <Link
            href={href}
            className="flex flex-col gap-1 rounded border p-4 hover:bg-muted"
        >
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="font-semibold text-2xl">{value}</span>
        </Link>
    )
}

export default async function HomePage() {
    let role: Parameters<typeof can>[0]
    try {
        const ctx = await requireWorkspace()
        role = ctx.role
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Home</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Join or select a workspace to see your dashboard.
                </p>
            </main>
        )
    }

    const allow = (key: NavKey) => can(role, key)

    const [
        overdue,
        alerts,
        visits,
        meds,
        maintenance,
        actionItems,
        budget,
        events
    ] = await Promise.all([
        rows(allow("tasks"), listOverdueCareTasks),
        rows(allow("alerts"), listAlerts),
        rows(allow("schedule"), listVisits),
        rows(allow("health"), listMedications),
        rows(allow("maintenance"), listMaintenanceTasks),
        rows(allow("action-items"), listActionItems),
        rows(allow("budget"), listBudgetLines),
        rows(allow("events"), listEvents)
    ])

    const nowIso = new Date().toISOString()

    const nextVisit = (visits ?? [])
        .map((v) => v as { title?: string; start?: string })
        .filter((v) => typeof v.start === "string" && v.start >= nowIso)
        .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))[0]

    const openAlerts = (alerts ?? []).filter(
        (a) => (a as { status?: string }).status === "open"
    ).length

    const monthlyNet = (budget ?? []).reduce((net, line) => {
        const l = line as {
            kind?: string
            monthlyActual?: number | null
            monthlyBudget?: number | null
        }
        const amount =
            typeof l.monthlyActual === "number"
                ? l.monthlyActual
                : typeof l.monthlyBudget === "number"
                  ? l.monthlyBudget
                  : 0
        return l.kind === "income" ? net + amount : net - amount
    }, 0)

    const today = nowIso.slice(0, 10)
    const upcomingEvents = (events ?? []).filter((e) => {
        const date = (e as { date?: string }).date
        return typeof date === "string" && date >= today
    }).length

    const cards: { label: string; value: string; href: string }[] = []
    if (overdue !== null)
        cards.push({
            label: "Overdue tasks",
            value: String(overdue.length),
            href: "/care/tasks"
        })
    if (alerts !== null)
        cards.push({
            label: "Open alerts",
            value: String(openAlerts),
            href: "/ops/alerts"
        })
    if (visits !== null)
        cards.push({
            label: "Next appointment",
            value: nextVisit?.start
                ? `${nextVisit.title ?? "Visit"} · ${nextVisit.start.slice(0, 10)}`
                : "—",
            href: "/care/schedule"
        })
    if (meds !== null)
        cards.push({
            label: "Medications",
            value: String(meds.length),
            href: "/care/meds"
        })
    if (maintenance !== null)
        cards.push({
            label: "Maintenance items",
            value: String(maintenance.length),
            href: "/household/maintenance"
        })
    if (actionItems !== null)
        cards.push({
            label: "Open action items",
            value: String(actionItems.length),
            href: "/ops/action-items"
        })
    if (budget !== null)
        cards.push({
            label: "Monthly net",
            value: `$${monthlyNet.toLocaleString()}`,
            href: "/ops/budget"
        })
    if (events !== null)
        cards.push({
            label: "Upcoming events",
            value: String(upcomingEvents),
            href: "/events"
        })

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Home</h1>
                <p className="text-muted-foreground text-sm">
                    Your care + estate operation at a glance.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {cards.map((c) => (
                    <Card
                        key={c.label}
                        label={c.label}
                        value={c.value}
                        href={c.href}
                    />
                ))}
            </div>
        </main>
    )
}
