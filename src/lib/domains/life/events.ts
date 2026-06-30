"use server"

import { revalidatePath } from "next/cache"
import {
    type CareEvent,
    type EventInput,
    type EventTask,
    type EventTaskInput,
    eventInput,
    eventTaskInput
} from "@/lib/domains/life/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import { requireAccess, requireWrite } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Event + event-task domain operations — clones the canonical Care daily-log
 * pattern. Every op: (1) RBAC guard FIRST (fail-closed; derives
 * `{userId, workspaceId}`), (2) constructs the Repository from that context
 * (tenant isolation by construction), (3) validates untrusted input with Zod at
 * the boundary, (4) returns a typed `ActionResult` envelope and never throws
 * across the boundary.
 *
 * An event is the parent aggregate: deleting one cascades to its eventTasks via
 * `eventId` (handled in the Repository, always within the same workspace).
 */

const EVENTS = "events" as const
const EVENT_TASKS = "eventTasks" as const

// --- events ---

/** List all events in the active workspace (view-gated). */
export async function listEvents(): Promise<ActionResult<CareEvent[]>> {
    try {
        const ctx = await requireAccess("events")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const events = await repo.list<CareEvent>(EVENTS)
        return ok(events)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create an event (write-gated to the `events` area). */
export async function createEvent(
    input: unknown
): Promise<ActionResult<CareEvent>> {
    try {
        const ctx = await requireWrite("events", "events")
        const parsed = eventInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const event = await repo.create<EventInput>(EVENTS, parsed.data)
        revalidatePath("/events")
        return ok(event)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing event (write-gated). Null id-miss → failure envelope. */
export async function updateEvent(
    id: string,
    patch: unknown
): Promise<ActionResult<CareEvent>> {
    try {
        const ctx = await requireWrite("events", "events")
        const parsed = eventInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<CareEvent>(EVENTS, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Event not found." }
        }
        revalidatePath("/events")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete an event and cascade its eventTasks (write-gated). */
export async function deleteEvent(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("events", "events")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(EVENTS, id)
        if (!removed) {
            return { status: false, message: "Event not found." }
        }
        revalidatePath("/events")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}

// --- event tasks ---

/** List event tasks in the active workspace (view-gated). */
export async function listEventTasks(): Promise<ActionResult<EventTask[]>> {
    try {
        const ctx = await requireAccess("events")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const tasks = await repo.list<EventTask>(EVENT_TASKS)
        return ok(tasks)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create an event task (write-gated to the `events` area). */
export async function createEventTask(
    input: unknown
): Promise<ActionResult<EventTask>> {
    try {
        const ctx = await requireWrite("events", "events")
        const parsed = eventTaskInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const task = await repo.create<EventTaskInput>(EVENT_TASKS, parsed.data)
        revalidatePath("/events")
        return ok(task)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update an existing event task (write-gated). Null id-miss → failure envelope. */
export async function updateEventTask(
    id: string,
    patch: unknown
): Promise<ActionResult<EventTask>> {
    try {
        const ctx = await requireWrite("events", "events")
        const parsed = eventTaskInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<EventTask>(
            EVENT_TASKS,
            id,
            parsed.data
        )
        if (!updated) {
            return { status: false, message: "Event task not found." }
        }
        revalidatePath("/events")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete an event task (write-gated). */
export async function deleteEventTask(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireWrite("events", "events")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(EVENT_TASKS, id)
        if (!removed) {
            return { status: false, message: "Event task not found." }
        }
        revalidatePath("/events")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
