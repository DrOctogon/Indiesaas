"use client"

import { useState, useTransition } from "react"
import {
    changeMemberRole,
    inviteMember,
    removeMember
} from "@/lib/domains/system/members"
import type { WorkspaceMember } from "@/lib/domains/system/types"
import { ROLE_IDS } from "@/lib/rbac/access"

/**
 * Members admin island (client). Wires the invite / role-change / remove entry
 * points to the guarded server actions and renders whatever envelope comes back.
 * It is purely cosmetic gating — every action re-guards server-side, and the
 * last-active-admin / seat-cap protections live in the org-plugin hooks, so a
 * blocked op surfaces here as a failure message rather than mutating state.
 */
export function MembersAdmin({
    members,
    currentUserId
}: {
    members: WorkspaceMember[]
    currentUserId: string
}) {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function onInvite(formData: FormData) {
        const email = String(formData.get("email") ?? "")
        const role = String(formData.get("role") ?? "")
        startTransition(async () => {
            const result = await inviteMember({ email, role })
            setMessage(
                result.status
                    ? `Invitation sent to ${result.data?.email}.`
                    : (result.message ?? "Failed to invite.")
            )
        })
    }

    function onChangeRole(memberId: string, role: string) {
        startTransition(async () => {
            const result = await changeMemberRole({ memberId, role })
            setMessage(
                result.status
                    ? "Role updated."
                    : (result.message ?? "Failed to update role.")
            )
        })
    }

    function onRemove(memberIdOrEmail: string) {
        startTransition(async () => {
            const result = await removeMember({ memberIdOrEmail })
            setMessage(
                result.status
                    ? "Member removed."
                    : (result.message ?? "Failed to remove member.")
            )
        })
    }

    return (
        <div className="flex flex-col gap-6">
            <form
                action={onInvite}
                className="flex max-w-md flex-col gap-3 rounded border p-4"
            >
                <h2 className="font-medium text-sm">Invite a member</h2>
                <label className="flex flex-col gap-1 text-sm">
                    Email
                    <input
                        type="email"
                        name="email"
                        required
                        className="rounded border px-2 py-1"
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    Role
                    <select
                        name="role"
                        defaultValue="caregiver"
                        className="rounded border px-2 py-1"
                    >
                        {ROLE_IDS.map((role) => (
                            <option key={role} value={role}>
                                {role}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                    {pending ? "Working…" : "Send invite"}
                </button>
            </form>

            <ul className="flex flex-col gap-2">
                {members.map((member) => {
                    const isSelf = member.userId === currentUserId
                    return (
                        <li
                            key={member.id}
                            className="flex flex-wrap items-center gap-3 rounded border px-3 py-2 text-sm"
                        >
                            <div className="min-w-0">
                                <span className="font-medium">
                                    {member.name || member.email}
                                </span>
                                <span className="ml-2 text-muted-foreground">
                                    {member.email}
                                </span>
                            </div>

                            <select
                                value={member.role}
                                disabled={pending || isSelf}
                                onChange={(event) =>
                                    onChangeRole(member.id, event.target.value)
                                }
                                className="ml-auto rounded border px-2 py-1"
                            >
                                {ROLE_IDS.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                disabled={pending || isSelf}
                                onClick={() => onRemove(member.id)}
                                className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                            >
                                Remove
                            </button>
                        </li>
                    )
                })}
            </ul>

            {message ? <p className="text-sm">{message}</p> : null}
        </div>
    )
}
