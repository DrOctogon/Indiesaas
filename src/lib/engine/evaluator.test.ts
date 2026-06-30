import { describe, expect, it } from "vitest"
import {
    type AlertRule,
    type DomainEvent,
    type EvaluateInput,
    evaluateEvent
} from "./evaluator"

const baseEvent: DomainEvent = {
    workspaceId: "ws-1",
    source: "dailyLog",
    action: "created",
    entityId: "dl-1",
    occurredAt: "2026-06-30T12:00:00.000Z"
}

const baseRule: AlertRule = {
    id: "ar-1",
    enabled: true,
    source: "dailyLog",
    trigger: "High pain reported",
    severity: "HIGH",
    recipients: ["caregiver"],
    channels: ["inApp", "email"],
    cooldownMinutes: 60
}

function makeInput(over: Partial<EvaluateInput> = {}): EvaluateInput {
    let n = 0
    return {
        event: baseEvent,
        rules: [baseRule],
        openAlerts: [],
        members: [{ userId: "u-1", role: "caregiver" }],
        preferences: [],
        now: new Date("2026-06-30T12:00:00.000Z"),
        mkId: () => `id-${++n}`,
        ...over
    }
}

describe("evaluateEvent", () => {
    it("emits an alert + a delivery per matched channel/member", () => {
        const r = evaluateEvent(makeInput())
        expect(r.alerts).toHaveLength(1)
        expect(r.alerts[0]?.dedupeKey).toBe("ar-1:dailyLog:dl-1")
        expect(r.alerts[0]?.workspaceId).toBe("ws-1")
        // inApp + email for the one caregiver = 2 deliveries
        expect(r.deliveries).toHaveLength(2)
    })

    it("inApp delivery is sent, email/push are pending", () => {
        const r = evaluateEvent(makeInput())
        const byChannel = Object.fromEntries(
            r.deliveries.map((d) => [d.channel, d.status])
        )
        expect(byChannel.inApp).toBe("sent")
        expect(byChannel.email).toBe("pending")
    })

    it("skips a disabled rule or a source mismatch (no-match)", () => {
        const disabled = evaluateEvent(
            makeInput({ rules: [{ ...baseRule, enabled: false }] })
        )
        expect(disabled.alerts).toHaveLength(0)
        expect(disabled.skipped[0]?.reason).toBe("no-match")

        const wrongSource = evaluateEvent(
            makeInput({ rules: [{ ...baseRule, source: "schedule" }] })
        )
        expect(wrongSource.alerts).toHaveLength(0)
    })

    it("suppresses within cooldown when an open alert shares the dedupe key", () => {
        const r = evaluateEvent(
            makeInput({
                openAlerts: [
                    {
                        dedupeKey: "ar-1:dailyLog:dl-1",
                        createdAt: "2026-06-30T11:30:00.000Z", // 30m < 60m cooldown
                        status: "open"
                    }
                ]
            })
        )
        expect(r.alerts).toHaveLength(0)
        expect(r.skipped[0]?.reason).toBe("cooldown")
    })

    it("does NOT suppress once cooldown has elapsed", () => {
        const r = evaluateEvent(
            makeInput({
                openAlerts: [
                    {
                        dedupeKey: "ar-1:dailyLog:dl-1",
                        createdAt: "2026-06-30T10:30:00.000Z", // 90m > 60m
                        status: "open"
                    }
                ]
            })
        )
        expect(r.alerts).toHaveLength(1)
    })

    it("skips when no member holds a recipient role (no-recipients)", () => {
        const r = evaluateEvent(
            makeInput({ members: [{ userId: "u-2", role: "household" }] })
        )
        expect(r.alerts).toHaveLength(0)
        expect(r.skipped[0]?.reason).toBe("no-recipients")
    })

    it("honors a muted channel preference (default-on otherwise)", () => {
        const r = evaluateEvent(
            makeInput({
                preferences: [
                    {
                        userId: "u-1",
                        channel: "email",
                        enabled: true,
                        mutedSources: ["dailyLog"]
                    }
                ]
            })
        )
        // email muted for this source → only the inApp delivery remains
        expect(r.deliveries.map((d) => d.channel)).toEqual(["inApp"])
    })
})
