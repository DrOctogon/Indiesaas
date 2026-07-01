import Link from "next/link"
import { listCareGoals } from "@/lib/domains/care/goals"
import { getRecipient } from "@/lib/domains/life/recipients"
import { requireAccess } from "@/lib/rbac/guards"

/**
 * Recipient detail (BUILD/02 §Recipients — `/recipients/[id]`). View-gated
 * (fail-closed); data read through the domain actions, which re-guard and scope
 * to the active workspace via the Repository, so a recipient from another
 * workspace is indistinguishable from a missing one (both → not-found state).
 * Sections mirror the spec's tabs: profile, emergency contacts, doctors, and a
 * care snapshot (goals G1–G8).
 */
export default async function RecipientDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    try {
        await requireAccess("recipients")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Recipient</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to recipients in this workspace.
                </p>
            </main>
        )
    }

    const { id } = await params
    const result = await getRecipient(id)
    const recipient = result.status ? result.data : null

    if (!recipient) {
        return (
            <main className="flex flex-col gap-4 p-6">
                <Link href="/recipients" className="text-sm underline">
                    ← Recipients
                </Link>
                <p className="text-muted-foreground text-sm">
                    Recipient not found.
                </p>
            </main>
        )
    }

    const goalsResult = await listCareGoals()
    const goals = (goalsResult.status ? (goalsResult.data ?? []) : []).filter(
        (g) => g.recipientId === id
    )

    return (
        <main className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-1">
                <Link href="/recipients" className="text-sm underline">
                    ← Recipients
                </Link>
                <h1 className="font-semibold text-xl">{recipient.name}</h1>
                <p className="text-muted-foreground text-sm">
                    {recipient.dob ? `dob ${recipient.dob}` : "no dob on file"}
                    {recipient.bloodType
                        ? ` · blood ${recipient.bloodType}`
                        : ""}
                    {recipient.insurance ? ` · ${recipient.insurance}` : ""}
                </p>
            </div>

            <section className="flex flex-col gap-2 rounded border p-4">
                <h2 className="font-medium text-sm">Profile</h2>
                <p className="text-sm">
                    <span className="text-muted-foreground">Conditions: </span>
                    {recipient.conditions.length
                        ? recipient.conditions.join(", ")
                        : "none recorded"}
                </p>
                <p className="text-sm">
                    <span className="text-muted-foreground">Allergies: </span>
                    {recipient.allergies.length
                        ? `⚠ ${recipient.allergies.join(", ")}`
                        : "none recorded"}
                </p>
                {recipient.notes ? (
                    <p className="text-sm">
                        <span className="text-muted-foreground">Notes: </span>
                        {recipient.notes}
                    </p>
                ) : null}
            </section>

            <section className="flex flex-col gap-2 rounded border p-4">
                <h2 className="font-medium text-sm">Emergency contacts</h2>
                {recipient.emergencyContacts.length ? (
                    <ul className="flex flex-col gap-1 text-sm">
                        {recipient.emergencyContacts.map((c) => (
                            <li key={c.id}>
                                <span className="font-medium">{c.name}</span> ·{" "}
                                {c.relation} · {c.phone}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        No emergency contacts.
                    </p>
                )}
            </section>

            <section className="flex flex-col gap-2 rounded border p-4">
                <h2 className="font-medium text-sm">Doctors</h2>
                {recipient.doctors.length ? (
                    <ul className="flex flex-col gap-1 text-sm">
                        {recipient.doctors.map((d) => (
                            <li key={d.id}>
                                <span className="font-medium">{d.name}</span> ·{" "}
                                {d.specialty} · {d.phone}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        No doctors on file.
                    </p>
                )}
            </section>

            <section className="flex flex-col gap-2 rounded border p-4">
                <h2 className="font-medium text-sm">
                    Care goals ({goals.length})
                </h2>
                {goals.length ? (
                    <ul className="flex flex-col gap-1 text-sm">
                        {goals.map((g) => (
                            <li key={g.id}>
                                <span className="font-medium">{g.code}</span> ·{" "}
                                {g.label}
                                {g.done ? " · ✓ done" : ""}
                                {g.trend ? ` · trend ${g.trend}` : ""}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        No care goals for this recipient.
                    </p>
                )}
            </section>
        </main>
    )
}
