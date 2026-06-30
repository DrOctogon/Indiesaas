import { requireWorkspace } from "@/lib/rbac/guards"
import { ExportAccountDataButton } from "./export-account-button"

/**
 * Per-user account data export page. Available to any authenticated workspace
 * member (no admin gate) — a user can always export their own portable data:
 * their user-global preferences, push subscriptions, and workspace memberships.
 * The export action re-guards with `requireWorkspace()` and only ever reads the
 * signed-in user's own rows.
 */
export default async function AccountDataPage() {
    try {
        await requireWorkspace()
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Your data</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Sign in to export your account data.
                </p>
            </main>
        )
    }

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Your data</h1>
                <p className="text-muted-foreground text-sm">
                    Download a JSON copy of your account data — your
                    preferences, notification subscriptions, and the workspaces
                    you belong to.
                </p>
            </div>
            <ExportAccountDataButton />
        </main>
    )
}
