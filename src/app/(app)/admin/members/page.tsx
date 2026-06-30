import { listMembers } from "@/lib/domains/system/members"
import { requireManage } from "@/lib/rbac/guards"
import { MembersAdmin } from "./members-admin"

/**
 * Members page (System area, admin-only — navKey "members"). The manage guard
 * runs FIRST and fail-closed: non-admins render the forbidden state, never the
 * roster. Members are read through the domain action (which re-guards and reads
 * via the Better Auth org plugin). The client island wires invite / role-change
 * / remove entry points to the guarded server actions; the last-active-admin and
 * seat-cap protections are enforced inside those actions' plugin hooks.
 */
export default async function MembersPage() {
    let actorUserId: string
    try {
        const ctx = await requireManage("members", ["admin"])
        actorUserId = ctx.userId
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Members</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to manage members in this workspace.
                </p>
            </main>
        )
    }

    const result = await listMembers()
    const members = result.status ? (result.data ?? []) : []

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Members</h1>
                <p className="text-muted-foreground text-sm">
                    {members.length} member{members.length === 1 ? "" : "s"} in
                    this workspace.
                </p>
            </div>

            <MembersAdmin members={members} currentUserId={actorUserId} />
        </main>
    )
}
