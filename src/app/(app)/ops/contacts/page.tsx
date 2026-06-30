import { listContacts } from "@/lib/domains/ops/contacts"
import { requireAccess } from "@/lib/rbac/guards"
import { NewContactForm } from "./new-contact-form"

/**
 * Contacts page (Operations area). View guard runs first (fail-closed); the
 * domain action re-guards, scopes to the workspace, and applies row-level
 * visibility filtering. Mirrors the canonical care/daily-log route.
 */
export default async function ContactsPage() {
    try {
        await requireAccess("contacts")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Contacts</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to contacts in this workspace.
                </p>
            </main>
        )
    }

    const result = await listContacts()
    const contacts = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Contacts</h1>
                <p className="text-muted-foreground text-sm">
                    {contacts.length} contact{contacts.length === 1 ? "" : "s"}{" "}
                    visible to you.
                </p>
            </div>

            <NewContactForm />

            <ul className="flex flex-col gap-2">
                {contacts.map((contact) => (
                    <li
                        key={contact.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{contact.name}</span> ·{" "}
                        {contact.category}
                        {contact.phone ? ` · ${contact.phone}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
