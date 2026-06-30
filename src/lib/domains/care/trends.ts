"use server"

import type { DailyLog, Vital } from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Care-trends — a READ-ONLY aggregate over dailyLogs + vitals (see BUILD/02
 * §Care Trends). Unlike the other care features there is NO write path: only the
 * view guard (`requireAccess("trends")`) runs, never `requireWrite`. The
 * aggregate is derived in-process from workspace-scoped reads through the
 * Repository; no new entity is persisted.
 */

/** One day's derived care-trend point. */
export interface TrendPoint {
    /** `YYYY-MM-DD`. */
    date: string
    painNow?: number
    sleepHours?: number
    moodConcern: boolean
    medMissed: boolean
}

/** Aggregate trend view: per-day daily-log series + the raw vitals series. */
export interface CareTrends {
    dailyLog: TrendPoint[]
    vitals: Vital[]
    counts: {
        dailyLogs: number
        vitals: number
        moodConcernDays: number
        medMissedDays: number
    }
}

/** Reduce one daily log to its trend-relevant fields. */
function toTrendPoint(log: DailyLog): TrendPoint {
    const medMissed = (log.meds ?? []).some(
        (m) => m.reminded === true && m.taken !== true
    )
    return {
        date: log.date,
        painNow: log.pain?.now,
        sleepHours: log.sleep?.hours,
        moodConcern: log.mood?.concernFlag === true,
        medMissed
    }
}

/**
 * Read-only care-trends aggregate for the active workspace. View-gated only —
 * no writes. Daily-log points are sorted ascending by date for charting.
 */
export async function getCareTrends(): Promise<ActionResult<CareTrends>> {
    try {
        const ctx = await requireAccess("trends")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const [logs, vitals] = await Promise.all([
            repo.list<DailyLog>("dailyLogs"),
            repo.list<Vital>("vitals")
        ])

        const dailyLog = logs
            .map(toTrendPoint)
            .sort((a, b) => a.date.localeCompare(b.date))

        return ok({
            dailyLog,
            vitals,
            counts: {
                dailyLogs: logs.length,
                vitals: vitals.length,
                moodConcernDays: dailyLog.filter((p) => p.moodConcern).length,
                medMissedDays: dailyLog.filter((p) => p.medMissed).length
            }
        })
    } catch (error) {
        return failFrom(error)
    }
}
