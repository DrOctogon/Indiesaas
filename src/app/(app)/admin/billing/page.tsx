import { headers } from "next/headers"
import CancelSubButton from "@/app/dashboard/billing/cancel-sub-button"
import PlanSelector from "@/app/dashboard/billing/plan-selector"
import { getWorkspaceSeatUsage } from "@/lib/domains/system/seats"
import { auth } from "@/lib/auth"
import { getActiveSubscription } from "@/lib/payments/actions"
import { type AuthContext, requireManage } from "@/lib/rbac/guards"

/**
 * Billing & Plan page (System area, admin-only — navKey "billing"). The manage
 * guard runs FIRST and fail-closed: non-admins render the forbidden state.
 *
 * This surfaces the EXISTING Stripe billing under the admin area — it reuses the
 * `getActiveSubscription` action and the `PlanSelector` / `CancelSubButton`
 * components from `app/dashboard/billing` rather than duplicating any Stripe
 * logic. Seat-cap enforcement at invite time lives in the Members feature.
 */
export default async function AdminBillingPage() {
    let authContext: AuthContext
    try {
        authContext = await requireManage("billing", ["admin"])
    } catch {
        return (
            <main className="p-6">
                <h1 className="font-semibold text-xl">Billing &amp; plan</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    You don’t have access to billing in this workspace.
                </p>
            </main>
        )
    }

    const requestHeaders = await headers()
    const session = await auth.api.getSession({ headers: requestHeaders })
    const result = await getActiveSubscription()
    const activeSub = result.subscription
    const seatUsage = await getWorkspaceSeatUsage(authContext.workspaceId)

    return (
        <main className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="font-semibold text-xl">Billing &amp; plan</h1>
                <p className="text-muted-foreground text-sm">
                    Manage this workspace’s subscription and plan.
                </p>
            </div>

            <div className="flex items-center justify-between rounded border p-4 text-sm">
                <span className="text-muted-foreground">Seats used</span>
                <span className="font-medium">
                    {seatUsage.cap === null
                        ? `${seatUsage.used} of unlimited`
                        : `${seatUsage.used} of ${seatUsage.cap}`}
                </span>
            </div>

            {activeSub ? (
                <div className="flex flex-col gap-3 rounded border p-4 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Plan</span>
                        <span className="font-medium capitalize">
                            {activeSub.plan}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-medium capitalize">
                            {activeSub.status}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Seats</span>
                        <span className="font-medium">{activeSub.seats}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                            Auto-renew
                        </span>
                        <span className="font-medium">
                            {activeSub.cancelAtPeriodEnd ? "No" : "Yes"}
                        </span>
                    </div>
                    {activeSub.cancelAtPeriodEnd ? (
                        <p className="text-destructive text-xs">
                            Cancels on{" "}
                            {activeSub.periodEnd?.toLocaleDateString()}
                        </p>
                    ) : (
                        <div className="flex justify-end">
                            <CancelSubButton />
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-muted-foreground text-sm">
                    No active subscription. Choose a plan below.
                </p>
            )}

            <PlanSelector activeSub={activeSub} session={session} />
        </main>
    )
}
