import { listDocuments } from "@/lib/domains/ops/documents"
import { requireAccess } from "@/lib/rbac/guards"
import { NewDocumentForm } from "./new-document-form"

/**
 * Documents page (Operations area) — ADMIN-ONLY. The view guard
 * `requireAccess("documents")` already fails closed for non-admins (documents
 * has no non-admin view access). Mirrors the canonical care/daily-log route.
 */
export default async function DocumentsPage() {
    try {
        await requireAccess("documents")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Documents</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to documents in this workspace.
                </p>
            </main>
        )
    }

    const result = await listDocuments()
    const docs = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Documents</h1>
                <p className="text-muted-foreground text-sm">
                    {docs.length} document{docs.length === 1 ? "" : "s"} in this
                    workspace.
                </p>
            </div>

            <NewDocumentForm />

            <ul className="flex flex-col gap-2">
                {docs.map((doc) => (
                    <li
                        key={doc.id}
                        className="rounded border px-3 py-2 text-sm"
                    >
                        <span className="font-medium">{doc.docType}</span> ·{" "}
                        {doc.status}
                        {doc.location ? ` · ${doc.location}` : ""}
                    </li>
                ))}
            </ul>
        </main>
    )
}
