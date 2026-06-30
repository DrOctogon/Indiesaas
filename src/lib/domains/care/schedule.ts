"use server"

import { revalidatePath } from "next/cache"
import {
    type ScheduleOccurrence,
    type ScheduleOccurrenceInput,
    type Visit,
    type VisitInput,
    scheduleOccurrenceInput,
    visitInput
} from "@/lib/domains/care/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import {
    type VisitLike,
    detectConflicts,
    findUpcomingVisits
} from "@/lib/engine/scheduling"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Schedule domain operations — clones the canonical daily-log pattern: guard
 * FIRST, construct the Repository from the auth context, validate untrusted
 * input with Zod at the boundary, return a typed ActionResult envelope.
 *
 * The conflict + upcoming views wire the pure scheduling engine. Visit instants
 * are absolute ISO datetimes, so conflict detection is timezone-independent;
 * the upcoming window is a minutes-from-injected-`now` check.
 */

const COLLECTION = "visits" as const
const OCCURRENCES = "scheduleOccurrences" as const

/** Default reminder window (minutes) for the "upcoming visits" sweep. */
const DEFAULT_UPCOMING_MINUTES = 60

/** List all visits in the active workspace (view-gated). */
export async function listVisits(): Promise<ActionResult<Visit[]>> {
    try {
        const ctx = await requireAccess("schedule")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<Visit>(COLLECTION))
    } catch (error) {
        return failFrom(error)
    }
}

/** Overlapping visit pairs in the active workspace (pure conflict engine). */
export async function listVisitConflicts(): Promise<
    ActionResult<[Visit, Visit][]>
> {
    try {
        const ctx = await requireAccess("schedule")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const visits = await repo.list<Visit>(COLLECTION)
        return ok(detectConflicts(visits as (Visit & VisitLike)[]))
    } catch (error) {
        return failFrom(error)
    }
}

/** Visits starting within the reminder window from `now` (pure engine). */
export async function listUpcomingVisits(
    withinMinutes: number = DEFAULT_UPCOMING_MINUTES
): Promise<ActionResult<Visit[]>> {
    try {
        const ctx = await requireAccess("schedule")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const visits = await repo.list<Visit>(COLLECTION)
        const upcoming = findUpcomingVisits(
            visits as (Visit & VisitLike)[],
            new Date(),
            withinMinutes
        )
        return ok(upcoming)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a visit (write-gated to the `care` area). */
export async function createVisit(
    input: unknown
): Promise<ActionResult<Visit>> {
    try {
        const ctx = await requireWrite("schedule", "care")
        const parsed = visitInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<VisitInput>(COLLECTION, parsed.data)
        revalidatePath("/care/schedule")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing visit (write-gated). */
export async function updateVisit(
    id: string,
    patch: unknown
): Promise<ActionResult<Visit>> {
    try {
        const ctx = await requireWrite("schedule", "care")
        const parsed = visitInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Visit>(COLLECTION, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Visit not found." }
        }
        revalidatePath("/care/schedule")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a visit (write-gated). Cascades its schedule occurrences (Repository). */
export async function deleteVisit(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("schedule", "care")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Visit not found." }
        }
        revalidatePath("/care/schedule")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}

/** List all schedule occurrences in the active workspace (view-gated). */
export async function listScheduleOccurrences(): Promise<
    ActionResult<ScheduleOccurrence[]>
> {
    try {
        const ctx = await requireAccess("schedule")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        return ok(await repo.list<ScheduleOccurrence>(OCCURRENCES))
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a schedule occurrence (write-gated to the `care` area). */
export async function createScheduleOccurrence(
    input: unknown
): Promise<ActionResult<ScheduleOccurrence>> {
    try {
        const ctx = await requireWrite("schedule", "care")
        const parsed = scheduleOccurrenceInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const created = await repo.create<ScheduleOccurrenceInput>(
            OCCURRENCES,
            parsed.data
        )
        revalidatePath("/care/schedule")
        return ok(created)
    } catch (error) {
        return failFrom(error)
    }
}
