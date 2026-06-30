import { getWorkspaceSettings } from "@/lib/domains/system/workspace"
import { requireManage } from "@/lib/rbac/guards"
import { WorkspaceSettingsForm } from "./workspace-settings-form"

/**
 * Workspace Settings page (System area, admin-only — navKey "workspace"). The
 * manage guard runs FIRST and fail-closed: non-admins render the forbidden
 * state. Settings are read through the domain action (which re-guards and reads
 * the active org via the Better Auth plugin); the client island posts edits back
 * through the guarded update action.
 */
export default async function WorkspacePage() {
    try {
        await requireManage("workspace", ["admin"])
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Workspace settings</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to workspace settings in this
                    workspace.
                </p>
            </main>
        )
    }

    const result = await getWorkspaceSettings()
    if (!result.status || !result.data) {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Workspace settings</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    {result.message ?? "Could not load workspace settings."}
                </p>
            </main>
        )
    }

    const settings = result.data

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Workspace settings</h1>
                <p className="text-muted-foreground text-sm">
                    Manage this workspace’s name and timezone.
                </p>
            </div>

            <WorkspaceSettingsForm
                name={settings.name}
                timezone={settings.timezone ?? ""}
            />
        </main>
    )
}
