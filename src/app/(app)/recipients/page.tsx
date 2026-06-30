import { listRecipients } from "@/lib/domains/life/recipients"
import { requireAccess } from "@/lib/rbac/guards"
import { NewRecipientForm } from "./new-recipient-form"

/**
 * Recipients page — clones the canonical M3 feature route. The view guard runs
 * first (fail-closed; an unauthorised role renders the forbidden state, never
 * the data). Data is read through the domain action, which re-guards and scopes
 * to the active workspace via the Repository.
 */
export default async function RecipientsPage() {
    try {
        await requireAccess("recipients")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Recipients</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to recipients in this workspace.
                </p>
            </main>
        )
    }

    const result = await listRecipients()
    const recipients = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Recipients</h1>
                <p className="text-muted-foreground text-sm">
                    {recipients.length} recipient
                    {recipients.length === 1 ? "" : "s"} in this workspace.
                </p>
            </div>

            <NewRecipientForm />

            <ul className="flex flex-col gap-2">
                {recipients.map((recipient) => (
                    <li
                        key={recipient.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{recipient.name}</span>
                        {recipient.dob ? ` · dob ${recipient.dob}` : ""}
                        {recipient.conditions.length
                            ? ` · ${recipient.conditions.length} condition${
                                  recipient.conditions.length === 1 ? "" : "s"
                              }`
                            : ""}
                        {recipient.allergies.length
                            ? ` · ⚠ ${recipient.allergies.length} allerg${
                                  recipient.allergies.length === 1 ? "y" : "ies"
                              }`
                            : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
