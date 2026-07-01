"use client"

import { useState, useTransition } from "react"
import {
    changeMemberRole,
    inviteMember,
    reactivateMember,
    removeMember,
    resendInvitation,
    revokeInvitation,
    suspendMember,
    transferOwnership
} from "@/lib/domains/system/members"
import type {
    PendingInvitation,
    WorkspaceMember
} from "@/lib/domains/system/types"
import { ROLE_IDS } from "@/lib/rbac/access"

/**
 * Members admin island (client). Wires the invite / role-change / remove /
 * suspend / reactivate / transfer-ownership entry points and the pending-invite
 * revoke / resend actions to the guarded server actions, rendering whatever
 * envelope comes back. It is purely cosmetic gating — every action re-guards
 * server-side, and the last-active-admin / seat-cap protections live in the
 * server actions, so a blocked op surfaces here as a failure message rather than
 * mutating state.
 */
export function MembersAdmin({
    members,
    invitations,
    currentUserId
}: {
    members: WorkspaceMember[]
    invitations: PendingInvitation[]
    currentUserId: string
}) {
    const [pending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function run(
        action: () => Promise<{ status: boolean; message?: string }>,
        ok: string
    ) {
        startTransition(async () => {
            const result = await action()
            setMessage(
                result.status ? ok : (result.message ?? "Action failed.")
            )
        })
    }

    function onInvite(formData: FormData) {
        const email = String(formData.get("email") ?? "")
        const role = String(formData.get("role") ?? "")
        run(() => inviteMember({ email, role }), `Invitation sent to ${email}.`)
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
                                {member.suspended ? (
                                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 text-xs">
                                        suspended
                                    </span>
                                ) : null}
                            </div>

                            <select
                                value={member.role}
                                disabled={pending || isSelf}
                                onChange={(event) =>
                                    run(
                                        () =>
                                            changeMemberRole({
                                                memberId: member.id,
                                                role: event.target.value
                                            }),
                                        "Role updated."
                                    )
                                }
                                className="ml-auto rounded border px-2 py-1"
                            >
                                {ROLE_IDS.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>

                            {member.role !== "admin" && !isSelf ? (
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                        run(
                                            () =>
                                                transferOwnership({
                                                    targetMemberId: member.id
                                                }),
                                            "Ownership transferred (promoted to admin)."
                                        )
                                    }
                                    className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                                >
                                    Make owner
                                </button>
                            ) : null}

                            {member.suspended ? (
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                        run(
                                            () =>
                                                reactivateMember({
                                                    memberId: member.id
                                                }),
                                            "Member reactivated."
                                        )
                                    }
                                    className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                                >
                                    Reactivate
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={pending || isSelf}
                                    onClick={() =>
                                        run(
                                            () =>
                                                suspendMember({
                                                    memberId: member.id
                                                }),
                                            "Member suspended."
                                        )
                                    }
                                    className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                                >
                                    Suspend
                                </button>
                            )}

                            <button
                                type="button"
                                disabled={pending || isSelf}
                                onClick={() =>
                                    run(
                                        () =>
                                            removeMember({
                                                memberIdOrEmail: member.id
                                            }),
                                        "Member removed."
                                    )
                                }
                                className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                            >
                                Remove
                            </button>
                        </li>
                    )
                })}
            </ul>

            {invitations.length > 0 ? (
                <div className="flex flex-col gap-2">
                    <h2 className="font-medium text-sm">Pending invitations</h2>
                    <ul className="flex flex-col gap-2">
                        {invitations.map((inv) => (
                            <li
                                key={inv.id}
                                className="flex flex-wrap items-center gap-3 rounded border px-3 py-2 text-sm"
                            >
                                <span className="font-medium">{inv.email}</span>
                                <span className="text-muted-foreground">
                                    {inv.role}
                                </span>
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                        run(
                                            () =>
                                                resendInvitation({
                                                    email: inv.email,
                                                    role: inv.role
                                                }),
                                            `Invitation resent to ${inv.email}.`
                                        )
                                    }
                                    className="ml-auto rounded border px-2 py-1 text-sm disabled:opacity-50"
                                >
                                    Resend
                                </button>
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                        run(
                                            () =>
                                                revokeInvitation({
                                                    invitationId: inv.id
                                                }),
                                            "Invitation revoked."
                                        )
                                    }
                                    className="rounded border px-2 py-1 text-sm disabled:opacity-50"
                                >
                                    Revoke
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {message ? <p className="text-sm">{message}</p> : null}
        </div>
    )
}
