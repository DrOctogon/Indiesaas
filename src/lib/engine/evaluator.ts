import type { RoleId } from "@/lib/rbac/access"

/**
 * Pure alert/notification evaluator (see BUILD/05 §1 — the most important thing
 * to port correctly). No I/O, fully deterministic: `now` and the id generator
 * are injected. It always operates within a SINGLE workspace — every input
 * (rules, open alerts, members, preferences) is already scoped to
 * `event.workspaceId`, and that id is carried into every alert and delivery it
 * emits. There is no cross-workspace fan-out.
 */

export type AlertSource =
    | "schedule"
    | "careTask"
    | "dailyLog"
    | "checklist"
    | "goal"
    | "landscaping"

export type AlertLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
export type NotificationChannel = "inApp" | "email" | "push"

export interface DomainEvent {
    workspaceId: string
    source: AlertSource
    action: "created" | "updated" | "removed"
    entityId: string
    occurredAt: string
}

export interface AlertRule {
    id: string
    enabled: boolean
    source: AlertSource
    trigger: string
    severity: AlertLevel
    recipients: RoleId[]
    channels: NotificationChannel[]
    cooldownMinutes: number
}

export interface OpenAlertRef {
    dedupeKey?: string
    /** ISO datetime the alert was created. */
    createdAt: string
    status?: "open" | "acknowledged" | "resolved"
}

export interface MemberRef {
    userId: string
    role: RoleId
}

export interface NotificationPreferenceRef {
    userId: string
    channel: NotificationChannel
    enabled: boolean
    mutedSources?: AlertSource[]
}

export interface EmittedAlert {
    id: string
    workspaceId: string
    level: AlertLevel
    category: AlertSource
    description: string
    status: "open"
    dedupeKey: string
    ruleId: string
    createdAt: string
}

export interface EmittedDelivery {
    id: string
    workspaceId: string
    alertId: string
    recipientUserId: string
    channel: NotificationChannel
    status: "sent" | "pending"
    dedupeKey: string
    attempts: number
    createdAt: string
}

export type SkipReason = "no-match" | "cooldown" | "no-recipients"

export interface EvaluateInput {
    event: DomainEvent
    rules: readonly AlertRule[]
    openAlerts: readonly OpenAlertRef[]
    members: readonly MemberRef[]
    preferences: readonly NotificationPreferenceRef[]
    /**
     * User ids opted into the daily digest. For these users, per-event email/push
     * deliveries are suppressed and batched into the daily digest instead
     * (BUILD/05 §digest — "batched into one summary delivery ... rather than
     * dispatched per event"). In-app deliveries still fire in real time.
     */
    digestUserIds?: readonly string[]
    now: Date
    mkId: () => string
}

export interface EvaluateResult {
    alerts: EmittedAlert[]
    deliveries: EmittedDelivery[]
    skipped: { ruleId: string; reason: SkipReason }[]
}

/** Whether a channel is allowed for a member, honoring per-(workspace,user) prefs (default-on). */
function channelAllowed(
    preferences: readonly NotificationPreferenceRef[],
    userId: string,
    channel: NotificationChannel,
    source: AlertSource
): boolean {
    const pref = preferences.find(
        (p) => p.userId === userId && p.channel === channel
    )
    if (!pref) return true // default-on when the member has no preference
    if (!pref.enabled) return false
    if (pref.mutedSources?.includes(source)) return false
    return true
}

export function evaluateEvent(input: EvaluateInput): EvaluateResult {
    const {
        event,
        rules,
        openAlerts,
        members,
        preferences,
        digestUserIds,
        now,
        mkId
    } = input
    const digestUsers = new Set(digestUserIds ?? [])
    const result: EvaluateResult = { alerts: [], deliveries: [], skipped: [] }
    const nowIso = now.toISOString()

    for (const rule of rules) {
        // 1. Match.
        if (!rule.enabled || rule.source !== event.source) {
            result.skipped.push({ ruleId: rule.id, reason: "no-match" })
            continue
        }

        // 2. Dedupe key (unique within the workspace).
        const dedupeKey = `${rule.id}:${event.source}:${event.entityId}`

        // 3. Cooldown — suppress if an open alert with the same key is within window.
        const cooldownMs = rule.cooldownMinutes * 60_000
        const onCooldown = openAlerts.some(
            (a) =>
                a.dedupeKey === dedupeKey &&
                a.status !== "resolved" &&
                now.getTime() - Date.parse(a.createdAt) < cooldownMs
        )
        if (onCooldown) {
            result.skipped.push({ ruleId: rule.id, reason: "cooldown" })
            continue
        }

        // 4. Audience — active members whose role is in the rule's recipients.
        const audience = members.filter((m) => rule.recipients.includes(m.role))
        if (audience.length === 0) {
            result.skipped.push({ ruleId: rule.id, reason: "no-recipients" })
            continue
        }

        // Emit the alert.
        const alert: EmittedAlert = {
            id: mkId(),
            workspaceId: event.workspaceId,
            level: rule.severity,
            category: event.source,
            description: rule.trigger,
            status: "open",
            dedupeKey,
            ruleId: rule.id,
            createdAt: nowIso
        }
        result.alerts.push(alert)

        // 5. Channels — one delivery per member × channel, honoring mute prefs.
        for (const member of audience) {
            const onDigest = digestUsers.has(member.userId)
            for (const channel of rule.channels) {
                // Digest users get real-time in-app only; their email/push for the
                // day is batched into the daily digest, not dispatched per event.
                if (onDigest && channel !== "inApp") {
                    continue
                }
                if (
                    !channelAllowed(
                        preferences,
                        member.userId,
                        channel,
                        event.source
                    )
                ) {
                    continue
                }
                result.deliveries.push({
                    id: mkId(),
                    workspaceId: event.workspaceId,
                    alertId: alert.id,
                    recipientUserId: member.userId,
                    channel,
                    status: channel === "inApp" ? "sent" : "pending",
                    dedupeKey: `${dedupeKey}:${member.userId}:${channel}`,
                    attempts: 0,
                    createdAt: nowIso
                })
            }
        }
    }

    return result
}
