import { zonedToUtc } from "@/lib/engine/time"

/**
 * Care-task overdue sub-engine (see BUILD/05 §pure sub-engines). Pure; time is
 * evaluated in WORKSPACE-LOCAL time — the default due time `23:59` and "overdue"
 * are resolved against `now` in the workspace timezone, never UTC. A task due
 * "today" in the workspace tz must NOT be marked overdue prematurely because the
 * server is in a different zone.
 */

export interface CareTaskLike {
    id: string
    /** `YYYY-MM-DD`; a task with no date is never overdue. */
    date?: string
    /** `HH:mm`; defaults to `23:59` workspace-local. */
    time?: string
    /** ISO datetime when completed; null/undefined = not done. */
    doneAt?: string | null
}

/** The UTC instant a task is due, from its workspace-local date + time (default 23:59). */
export function taskDueAt(task: CareTaskLike, timeZone: string): Date | null {
    if (!task.date) return null
    return zonedToUtc(task.date, task.time, timeZone)
}

/** A task is overdue when it is not done and its workspace-local due instant has passed. */
export function isOverdue(
    task: CareTaskLike,
    now: Date,
    timeZone: string
): boolean {
    if (task.doneAt) return false
    const due = taskDueAt(task, timeZone)
    if (!due) return false
    return due.getTime() < now.getTime()
}

/** All overdue tasks in the set, evaluated in workspace-local time. */
export function findOverdueTasks<T extends CareTaskLike>(
    tasks: readonly T[],
    now: Date,
    timeZone: string
): T[] {
    return tasks.filter((task) => isOverdue(task, now, timeZone))
}
