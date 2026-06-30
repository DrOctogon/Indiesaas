import { listAuditEntries } from "@/lib/domains/system/audit"
import { requireManage } from "@/lib/rbac/guards"

/**
 * Audit Trail page (System area, admin-only — navKey "audit"). The manage guard
 * runs FIRST and fail-closed: a non-admin role renders the forbidden state and
 * never the data. The list is read through the domain helper, which re-guards
 * and scopes strictly to the active workspace. Read-only — no mutations here.
 */
export default async function AuditPage() {
    try {
        await requireManage("audit", ["admin"])
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Audit trail</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to the audit trail in this workspace.
                </p>
            </main>
        )
    }

    const result = await listAuditEntries()
    const entries = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Audit trail</h1>
                <p className="text-muted-foreground text-sm">
                    {entries.length} recent event
                    {entries.length === 1 ? "" : "s"} in this workspace.
                </p>
            </div>

            {entries.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    No audit events recorded yet.
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            className="rounded border px-3 py-2 text-sm"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">
                                    {entry.action}
                                </span>
                                <span className="text-muted-foreground">
                                    {entry.collection}
                                    {entry.entityId
                                        ? ` · ${entry.entityId}`
                                        : ""}
                                </span>
                                <span className="ml-auto text-muted-foreground text-xs">
                                    {entry.createdAt.toLocaleString()}
                                </span>
                            </div>
                            <p className="mt-1 text-muted-foreground text-xs">
                                actor {entry.actorUserId}
                                {entry.ip ? ` · ${entry.ip}` : ""}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    )
}
