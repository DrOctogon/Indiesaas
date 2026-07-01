import { and, eq, inArray, sql } from "drizzle-orm"
import {
    accountPreferences,
    type CollectionName,
    notificationSubscriptions
} from "@/database/collections"
import { db } from "@/database/db"
import { members, users } from "@/database/schema"
import type {
    AlertRule,
    DomainEvent,
    EmittedAlert,
    MemberRef,
    NotificationChannel,
    NotificationPreferenceRef,
    OpenAlertRef
} from "@/lib/engine/evaluator"
import { evaluateEvent } from "@/lib/engine/evaluator"
import { sendEmail } from "@/lib/notify/channels/email"
import {
    type PushSubscriptionRecord,
    buildPushPayload,
    sendPush
} from "@/lib/notify/channels/push"
import { ROLE_IDS, type RoleId } from "@/lib/rbac/access"
import { Repository } from "@/lib/repository"

/**
 * The dispatch keystone (see BUILD/05 §emitForEvent). Given a domain event in a
 * SINGLE workspace, it loads that workspace's active rules, open alerts,
 * members, and preferences, runs the pure `evaluateEvent` engine, persists the
 * emitted alerts + deliveries through the workspace-scoped Repository, then fans
 * pending deliveries out to the email/push channels (each a no-op when
 * unconfigured). Only the event-workspace's members are ever loaded as
 * recipients, so deliveries never leak across workspaces.
 *
 * It NEVER throws — a notification failure must not break the domain mutation
 * that triggered it. Returns counts for logging/telemetry.
 */

const ALERTS: CollectionName = "alerts"
const ALERT_RULES: CollectionName = "alertRules"
const PREFS: CollectionName = "notificationPreferences"
const DELIVERIES: CollectionName = "notificationDeliveries"

function toRoleId(role: string): RoleId | null {
    return ROLE_IDS.includes(role as RoleId) ? (role as RoleId) : null
}

/**
 * Which of `userIds` have opted into the daily digest (user-global
 * `accountPreferences.dailyDigest`). These users' per-event email/push is
 * suppressed by the evaluator and batched into the daily digest instead.
 */
async function loadDigestUserIds(
    userIds: readonly string[]
): Promise<string[]> {
    if (userIds.length === 0) return []
    const rows = (await db
        .select({ data: accountPreferences.data })
        .from(accountPreferences)
        .where(
            inArray(sql`${accountPreferences.data} ->> 'userId'`, [...userIds])
        )) as { data: { userId?: string; dailyDigest?: boolean } }[]
    return rows
        .filter((r) => r.data?.dailyDigest === true)
        .map((r) => r.data.userId)
        .filter((id): id is string => typeof id === "string")
}

interface StoredAlert extends EmittedAlert {
    acknowledgedAt?: string
    resolvedAt?: string
}

export interface DispatchResult {
    alerts: number
    deliveries: number
}

export async function emitForEvent(
    event: DomainEvent,
    actorId: string
): Promise<DispatchResult> {
    try {
        const repo = new Repository(actorId, event.workspaceId)

        const rules = (await repo.list<AlertRule>(ALERT_RULES)).filter(
            (r) => r.enabled
        )
        if (rules.length === 0) return { alerts: 0, deliveries: 0 }

        const openAlerts: OpenAlertRef[] = (
            await repo.list<StoredAlert>(ALERTS)
        ).map((a) => ({
            dedupeKey: a.dedupeKey,
            createdAt: a.createdAt,
            status: a.status
        }))

        const memberRows = await db
            .select({ userId: members.userId, role: members.role })
            .from(members)
            .where(eq(members.organizationId, event.workspaceId))
        const memberRefs: MemberRef[] = memberRows
            .map((m) => ({ userId: m.userId, role: toRoleId(m.role) }))
            .filter((m): m is MemberRef => m.role !== null)

        const preferences = (
            await repo.list<NotificationPreferenceRef>(PREFS)
        ).map((p) => ({
            userId: p.userId,
            channel: p.channel,
            enabled: p.enabled,
            mutedSources: p.mutedSources
        }))

        // Digest-opted members: their per-event email/push is suppressed and
        // batched into the daily digest instead (BUILD/05 §digest). Same
        // `accountPreferences.dailyDigest` source the digest cron reads, so
        // suppression and batching always agree — no double-notification.
        const digestUserIds = await loadDigestUserIds(
            memberRefs.map((m) => m.userId)
        )

        let counter = 0
        const mkId = () => `tmp-${++counter}`

        const result = evaluateEvent({
            event,
            rules,
            openAlerts,
            members: memberRefs,
            preferences,
            digestUserIds,
            now: new Date(),
            mkId
        })
        if (result.alerts.length === 0) return { alerts: 0, deliveries: 0 }

        // Persist alerts, remapping the engine's temp ids → real Repository ids.
        const alertById = new Map<string, EmittedAlert>()
        const idMap = new Map<string, string>()
        for (const alert of result.alerts) {
            alertById.set(alert.id, alert)
            const { id: _tempId, ...rest } = alert
            const saved = await repo.create(ALERTS, rest)
            idMap.set(alert.id, saved.id)
        }

        // Persist deliveries with remapped alert ids.
        for (const delivery of result.deliveries) {
            const { id: _tempId, alertId, ...rest } = delivery
            await repo.create(DELIVERIES, {
                ...rest,
                alertId: idMap.get(alertId) ?? alertId
            })
        }

        await fanOut(result.deliveries, alertById)

        return {
            alerts: result.alerts.length,
            deliveries: result.deliveries.length
        }
    } catch (error) {
        console.error("[notify/dispatch] emitForEvent failed", error)
        return { alerts: 0, deliveries: 0 }
    }
}

interface PendingDelivery {
    recipientUserId: string
    channel: NotificationChannel
    status: string
    alertId: string
}

/** Fan pending email/push deliveries out to their channels. Never throws. */
async function fanOut(
    deliveries: readonly PendingDelivery[],
    alertById: Map<string, EmittedAlert>
): Promise<void> {
    const emailByUser = new Map<string, string>()

    for (const delivery of deliveries) {
        if (delivery.status !== "pending") continue
        const alert = alertById.get(delivery.alertId)
        if (!alert) continue

        if (delivery.channel === "email") {
            const to = await resolveEmail(delivery.recipientUserId, emailByUser)
            if (to) {
                await sendEmail(
                    to,
                    `HomeCare alert · ${alert.level}`,
                    alert.description
                )
            }
        } else if (delivery.channel === "push") {
            const subs = await loadSubscriptions(delivery.recipientUserId)
            const { deadEndpoints } = await sendPush(
                subs,
                buildPushPayload(alert)
            )
            if (deadEndpoints.length) {
                await pruneSubscriptions(
                    delivery.recipientUserId,
                    deadEndpoints
                )
            }
        }
    }
}

async function resolveEmail(
    userId: string,
    cache: Map<string, string>
): Promise<string | null> {
    const cached = cache.get(userId)
    if (cached) return cached
    const rows = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    const email = rows[0]?.email ?? null
    if (email) cache.set(userId, email)
    return email
}

interface SubscriptionRow {
    data: PushSubscriptionRecord & { endpoint: string }
}

/** Load a user's Web Push subscriptions (user-global; not workspace-scoped). */
async function loadSubscriptions(
    userId: string
): Promise<PushSubscriptionRecord[]> {
    const rows = (await db
        .select({ data: notificationSubscriptions.data })
        .from(notificationSubscriptions)
        .where(
            eq(sql`${notificationSubscriptions.data} ->> 'userId'`, userId)
        )) as SubscriptionRow[]
    return rows
        .map((r) => r.data)
        .filter((d) => Boolean(d?.endpoint && d?.keys))
}

/** Remove dead Web Push subscriptions by endpoint for a user. */
async function pruneSubscriptions(
    userId: string,
    endpoints: readonly string[]
): Promise<void> {
    for (const endpoint of endpoints) {
        await db
            .delete(notificationSubscriptions)
            .where(
                and(
                    eq(
                        sql`${notificationSubscriptions.data} ->> 'userId'`,
                        userId
                    ),
                    eq(
                        sql`${notificationSubscriptions.data} ->> 'endpoint'`,
                        endpoint
                    )
                )
            )
    }
}
