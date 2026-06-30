"use server"

import { revalidatePath } from "next/cache"
import {
    type Contact,
    type ContactInput,
    contactInput
} from "@/lib/domains/ops/types"
import { type ActionResult, failFrom, ok } from "@/lib/domains/result"
import type { RoleId } from "@/lib/rbac/access"
import { requireAccess, requireManage } from "@/lib/rbac/guards"
import { Repository } from "@/lib/repository"

/**
 * Contact domain operations (see BUILD/02 §Contacts, BUILD/04 §row-level filters
 * line 119). Guard-first, fail-closed, returns the `ActionResult` envelope.
 *
 * WRITE-AREA CHOICE (documented — ambiguous): the shared contact directory has
 * no dedicated `WriteArea` and no explicit catalog Write role-set. Writes use
 * `requireManage("contacts", [all four roles])` (every viewing role may write);
 * the access mechanism the spec specifies is row-level visibility on read.
 */

const COLLECTION = "contacts" as const
const WRITE_ROLES = ["admin", "caregiver", "family", "household"] as const

/** Category → default visible roles when no explicit visibleToRoles (BUILD/04 line 119). */
const CATEGORY_DEFAULTS: Record<string, RoleId[]> = {
    EMERGENCY: ["caregiver", "family", "household"],
    FAMILY: ["family"],
    MEDICAL: ["caregiver", "family"],
    CARE_TEAM: ["caregiver", "family"],
    HOUSEHOLD: ["household"],
    PROFESSIONAL: [], // admin only
    UTILITIES: ["household"]
}

function visibleToRole(contact: Contact, role: RoleId): boolean {
    if (role === "admin") return true
    // shared (default) → everyone
    if (!contact.visibility || contact.visibility === "shared") return true
    // explicit role list takes precedence
    if (contact.visibleToRoles?.length) {
        return contact.visibleToRoles.includes(role)
    }
    // fall back to category defaults
    const roles = CATEGORY_DEFAULTS[contact.category]
    if (!roles) return false
    return roles.includes(role)
}

/** List contacts, visibility-filtered to the caller's role (view-gated). */
export async function listContacts(): Promise<ActionResult<Contact[]>> {
    try {
        const ctx = await requireAccess("contacts")
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const contacts = await repo.list<Contact>(COLLECTION)
        const visible = contacts.filter((c) => visibleToRole(c, ctx.role))
        return ok(visible)
    } catch (error) {
        return failFrom(error)
    }
}

/** Create a contact. */
export async function createContact(
    input: unknown
): Promise<ActionResult<Contact>> {
    try {
        const ctx = await requireManage("contacts", WRITE_ROLES)
        const parsed = contactInput.safeParse(input)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const contact = await repo.create<ContactInput>(COLLECTION, parsed.data)
        revalidatePath("/ops/contacts")
        return ok(contact)
    } catch (error) {
        return failFrom(error)
    }
}

/** Update a contact. */
export async function updateContact(
    id: string,
    patch: unknown
): Promise<ActionResult<Contact>> {
    try {
        const ctx = await requireManage("contacts", WRITE_ROLES)
        const parsed = contactInput.partial().safeParse(patch)
        if (!parsed.success) {
            return { status: false, message: parsed.error.issues[0]?.message }
        }
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const updated = await repo.update<Contact>(COLLECTION, id, parsed.data)
        if (!updated) {
            return { status: false, message: "Contact not found." }
        }
        revalidatePath("/ops/contacts")
        return ok(updated)
    } catch (error) {
        return failFrom(error)
    }
}

/** Delete a contact. */
export async function deleteContact(
    id: string
): Promise<ActionResult<{ id: string }>> {
    try {
        const ctx = await requireManage("contacts", WRITE_ROLES)
        const repo = new Repository(ctx.userId, ctx.workspaceId)
        const removed = await repo.remove(COLLECTION, id)
        if (!removed) {
            return { status: false, message: "Contact not found." }
        }
        revalidatePath("/ops/contacts")
        return ok({ id })
    } catch (error) {
        return failFrom(error)
    }
}
