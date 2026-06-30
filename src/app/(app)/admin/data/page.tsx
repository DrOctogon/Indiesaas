import { getWorkspaceSettings } from "@/lib/domains/system/workspace"
import { requireManage } from "@/lib/rbac/guards"
import { DeleteWorkspaceDataForm } from "./delete-data-form"

/**
 * Data lifecycle page (System area, admin-only — navKey "workspace"). Surfaces
 * the GDPR-style per-workspace export (download link) and the DESTRUCTIVE
 * per-workspace delete (typed-confirmation form). The manage guard runs FIRST
 * and fail-closed: a non-admin never sees the controls. The export download and
 * the delete action both re-guard server-side, so this gating is cosmetic.
 */
export default async function AdminDataPage() {
    try {
        await requireManage("workspace", ["admin"])
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Data</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to data export and deletion in this
                    workspace.
                </p>
            </main>
        )
    }

    const settings = await getWorkspaceSettings()
    const workspaceName = settings.status
        ? (settings.data?.name ?? "this workspace")
        : "this workspace"

    return (
        <main className="flex flex-col gap-8 p-6">
            <div>
                <h1 className="font-semibold text-xl">Data</h1>
                <p className="text-muted-foreground text-sm">
                    Export or permanently delete this workspace’s data.
                </p>
            </div>

            <section className="flex flex-col gap-2">
                <h2 className="font-medium text-base">Export workspace data</h2>
                <p className="text-muted-foreground text-sm">
                    Download a complete JSON dump of every collection in this
                    workspace.
                </p>
                <a
                    href="/admin/data/export"
                    className="w-fit rounded bg-black px-3 py-1.5 text-sm text-white"
                    download
                >
                    Download JSON export
                </a>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="font-medium text-base text-red-600">
                    Delete workspace data
                </h2>
                <p className="text-muted-foreground text-sm">
                    Permanently delete <strong>all</strong> domain data in this
                    workspace — recipients, vitals, medications, logs, tasks,
                    documents, and everything else. This is{" "}
                    <strong>irreversible</strong>. The workspace, its members,
                    and billing are kept; only the data is erased. Type the
                    workspace name to confirm.
                </p>
                <DeleteWorkspaceDataForm workspaceName={workspaceName} />
            </section>
        </main>
    )
}
