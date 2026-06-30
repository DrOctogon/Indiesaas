import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/database/db"
import { organizations, users } from "@/database/schema"
import { Repository } from "@/lib/repository"

/**
 * Tenant-isolation integration test — the #1 invariant (see
 * BUILD/03-data-model.md §Repository seam): a Repository scoped to workspace A
 * can never read or mutate workspace B's data, even when handed B's exact
 * entity id. Exercises the real Postgres data path, not a mock.
 *
 * Requires a reachable `DATABASE_URL` (migrated schema); skipped otherwise so
 * the unit suite stays runnable without a database. Run locally with:
 *   set -a && . ./.env.local && set +a && npx vitest run src/lib/repository.integration.test.ts
 */

const VISITS = "visits" as const

const hasDb = Boolean(process.env.DATABASE_URL)

const tag = randomUUID().slice(0, 8)
const userId = `u-iso-${tag}`
const orgA = `org-a-${tag}`
const orgB = `org-b-${tag}`

describe.skipIf(!hasDb)("Repository tenant isolation", () => {
    beforeAll(async () => {
        const now = new Date()
        await db.insert(users).values({
            id: userId,
            name: "Isolation Probe",
            email: `iso-${tag}@example.test`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now
        })
        await db.insert(organizations).values([
            {
                id: orgA,
                name: "Workspace A",
                slug: `ws-a-${tag}`,
                createdAt: now
            },
            {
                id: orgB,
                name: "Workspace B",
                slug: `ws-b-${tag}`,
                createdAt: now
            }
        ])
    })

    afterAll(async () => {
        // Deleting the orgs cascades all domain rows + audit rows by workspace FK.
        await db.delete(organizations).where(eq(organizations.id, orgA))
        await db.delete(organizations).where(eq(organizations.id, orgB))
        await db.delete(users).where(eq(users.id, userId))
    })

    it("scopes reads, blocks cross-tenant reads and writes by entity id", async () => {
        const repoA = new Repository(userId, orgA)
        const repoB = new Repository(userId, orgB)

        const visitBase = {
            recipientId: "r-x",
            title: "Visit",
            type: "doctor",
            start: "2026-07-01T10:00:00.000Z",
            end: "2026-07-01T11:00:00.000Z"
        }
        const a = await repoA.create(VISITS, { ...visitBase, title: "A visit" })
        const b = await repoB.create(VISITS, { ...visitBase, title: "B visit" })

        // list() is workspace-scoped: A sees only its own row.
        const listA = await repoA.list(VISITS)
        const idsA = listA.map((v) => (v as { id: string }).id)
        expect(idsA).toContain(a.id)
        expect(idsA).not.toContain(b.id)

        // get() by B's id from A's repo must be invisible.
        expect(await repoA.get(VISITS, b.id)).toBeNull()
        // own row still readable.
        expect(await repoA.get(VISITS, a.id)).not.toBeNull()

        // update() across tenants is a no-op returning null.
        expect(await repoA.update(VISITS, b.id, { title: "hacked" })).toBeNull()
        // remove() across tenants returns false.
        expect(await repoA.remove(VISITS, b.id)).toBe(false)

        // B's row is untouched by A's attempts.
        const bAfter = await repoB.get<{ title: string }>(VISITS, b.id)
        expect(bAfter).not.toBeNull()
        expect(bAfter?.title).toBe("B visit")
    })
})
