import { pushEnabled } from "@/lib/notify/channels/push"
import { requireAccess } from "@/lib/rbac/guards"
import { getDigestPreference } from "./digest-actions"
import { DigestToggle } from "./digest-toggle"
import { PushSubscribe } from "./push-subscribe"

/**
 * Account · Notifications page (see BUILD/05 §push + §digest). View-gated first
 * (fail-closed). Resolves push availability (`pushEnabled()`) and the public
 * VAPID key server-side and passes them to the subscribe client component, and
 * reads the user's daily-digest opt-in for the toggle's initial state.
 */
export default async function NotificationsPage() {
    try {
        await requireAccess("notifications")
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Notifications</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to notifications in this workspace.
                </p>
            </main>
        )
    }

    const enabled = pushEnabled()
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
    const digestResult = await getDigestPreference()
    const digestEnabled = digestResult.status
        ? (digestResult.data ?? false)
        : false

    return (
        <main className="flex max-w-lg flex-col gap-8 p-6">
            <div>
                <h1 className="font-semibold text-xl">Notifications</h1>
                <p className="text-muted-foreground text-sm">
                    Manage push notifications and your daily email digest.
                </p>
            </div>

            <section className="flex flex-col gap-3">
                <h2 className="font-medium text-sm">Push notifications</h2>
                <PushSubscribe
                    enabled={enabled}
                    vapidPublicKey={vapidPublicKey}
                />
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="font-medium text-sm">Daily digest</h2>
                <DigestToggle initialEnabled={digestEnabled} />
            </section>
        </main>
    )
}
