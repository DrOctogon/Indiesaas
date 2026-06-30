# Plan: HomeCare Rebuild on the `indie` Next.js Base

**Source spec**: `BUILD/01..06` (HomeCare — multi-tenant elder + estate care console)
**Base**: Next.js 15 (App Router/Turbopack) · React 19 · TS · Better Auth · Drizzle (Postgres) · Stripe · Biome
**Selected milestone**: M0–M1 (Foundation: tenancy + data + RBAC + audit) — features/engines scoped as later milestones
**Complexity**: Large (multi-milestone; ~41 collections, 30+ screens, alert/notification engine)

## Locked architecture decisions (from user)
1. **Data model = JSONB-uniform + ONE generic repository.** Each collection is a `pgTable(id, workspace_id FK→organization, data jsonb, created_at, updated_at)` built by a factory. A single `Repository` (`list/create/update/remove/removeWhere`) constructed with `{ userId, workspaceId }` auto-scopes every query by `workspace_id` and writes a before/after audit row on every mutation. Intra-domain cascades (recipient→children, medication→medLogs) live in the repository.
2. **Tenancy = Better Auth Organization plugin.** workspace = organization, membership = member(role), invite = invitation, active workspace = `session.activeOrganizationId`. Roles `admin | caregiver | family | household` defined via the plugin's access-control. Layer on: member seat cap (Stripe plan), last-active-admin guard, per-workspace seeding, `membership_status` mapping.

## Summary
Rebuild HomeCare's behavior (not its old stack) on this starter. Build the tenancy/auth/RBAC spine **first**, then the JSONB data layer + generic repository + audit, then the **pure** engines (alert evaluator, scheduling, escalation, ICS, workspace-local time), then features area-by-area, then optional integrations + seed + data lifecycle. Tenant isolation (`workspace_id` on every row, every query filtered) is the #1 invariant and is enforced centrally in the repository + a server-action guard, not per feature.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Auth config | `src/lib/auth.ts` | `betterAuth({ plugins:[stripe(...)] })` at import time — add `organization(...)` + access-control here |
| Schema | `src/database/schema.ts` | Drizzle `pgTable`, plural table names, `text/timestamp/jsonb` — collection factory mirrors this |
| DB client | `src/database/db.ts` | single `drizzle(DATABASE_URL)` export — repository imports `db` |
| Server actions | `src/lib/payments/actions.ts` | `"use server"`, `auth.api.getSession({ headers })` gate, typed `{status,message,data}` return — every domain op mirrors this + adds `requireAccess/requireWrite/requireManage` |
| Plans/config | `src/lib/payments/plans.ts` | typed `plans[]` with `limits` — add `seats` to limits for seat cap |
| Migrations | `drizzle.config.ts` → `migrations/` | `drizzle-kit generate` from `schema.ts`; regen auth tables per CLAUDE.md (`set -a && . ./.env.local`) |
| Validation | rules (typescript) | Zod at boundaries; infer types from schema |

## Milestones (sequential gates; features parallelize within M3+)

### M0 — Foundation decisions & scaffolding *(blocking, 1 agent)*
- Add `organization` plugin + access-control (4 roles) to `src/lib/auth.ts`; regen Better Auth tables (organization/member/invitation/session.activeOrganizationId) and merge into `schema.ts`.
- Collection factory `src/database/collections.ts` (uniform pgTable builder) + the 41 collection table defs + the 2 user-global exceptions (`accountPreferences`, `notificationSubscriptions` — no workspace_id).
- `audit_log` table (uuid, workspaceId, actorUserId, action enum, collection, entityId, before/after jsonb, ip?, createdAt; indexes).
- Generate + run migration.

### M1 — Tenancy + RBAC spine *(blocking, 1–2 agents)*
- Session active-workspace resolution + workspace switcher data hook.
- `can(role, navKey)` view matrix, `canWrite(role, area)` write matrix, `requireAccess/requireWrite/requireManage` server guards (fail closed). Source of truth = `src/lib/rbac/matrix.ts`.
- Row-level filters (action items by tag, contacts by visibility, alerts by rule recipients).
- Membership lifecycle on top of the plugin: status mapping (`active|invited|suspended|revoked`), last-active-admin guard (race-safe SQL), invite email-binding, seat-cap-at-invite, leave/transfer/delete-workspace.
- Signup-creates-workspace + seed hook; invite→accept flow.

### M2 — Generic repository + audit + engines *(parallel: repo-agent ‖ engine-agent)*
- **Repo agent**: `Repository` class (scoped CRUD + cascades + audit-on-write); negative cross-tenant test.
- **Engine agent (pure, TDD-first)**: `evaluateEvent` (match/dedupe/cooldown/audience/channel), escalation thresholds (pain≥8, sleep<3h, mood concernFlag, reminded-not-taken), care-task `isOverdue`/`findOverdueTasks`, scheduling `findUpcomingVisits`/`detectConflicts`, **workspace-local-time** helpers (inject IANA tz + now), `buildIcs` (RFC 5545). No I/O — fully unit-tested.

### M3 — Features by area *(parallel: one agent per area, file-ownership isolated)*
Each area agent owns its route dir + its domain ops file + its cache slice, all going through the M2 repository + M1 guards. Areas: **Care** (daily-log, checklist, schedule, meds, vitals, goals, plans, weekly-report, tasks, trends), **Operations** (alerts, action-items, rhythm, budget*, documents*, contacts), **Household** (property, maintenance, landscaping, vendors, tenants*, inventory), **Life** (recipients, events), **System*** (audit, members, workspace settings, billing). `*` = admin-only.

## Multi-agent execution model
**Topology**: a Lead (this thread) sequences gates and integrates; specialist agents own non-overlapping file sets so they run concurrently without write conflicts. Use ECC agents: `architect` (M0/M1 design), `tdd-guide` (M2 engines), `database-reviewer` (schema/repo), `typescript-reviewer`+`react-reviewer` (per feature stream), `security-reviewer` (tenant-isolation audit), `e2e-runner` (acceptance), `code-reviewer` (each PR).

| Stream | Agent(s) | Owns (files) | Depends on | Parallel? |
|---|---|---|---|---|
| S0 Foundation | architect + 1 impl | `auth.ts`, `schema.ts`, `database/collections.ts`, migration | — | no (gate) |
| S1 RBAC spine | impl + security-reviewer | `lib/rbac/*`, membership lifecycle, session/switcher | S0 | no (gate) |
| S2a Repository | impl + database-reviewer | `lib/repository.ts`, cascades, audit writer | S0 | yes ‖ S2b |
| S2b Engines | tdd-guide | `lib/engine/*` (pure), tests | S0 (types only) | yes ‖ S2a |
| S3 Care | react+ts reviewer | `app/(app)/care/*`, `lib/domains/care/*` | S1,S2a | yes |
| S3 Ops | react+ts reviewer | `app/(app)/ops/*`, `lib/domains/ops/*` | S1,S2a | yes |
| S3 Household | react+ts reviewer | `app/(app)/household/*`, `lib/domains/household/*` | S1,S2a | yes |
| S3 Life+System | react+ts reviewer | `app/(app)/{recipients,events,admin}/*` | S1,S2a | yes |
| S4 Dispatch/Integr. | impl + security | `lib/notify/*`, billing, export | S2a,S2b,S3 | partial |
| Xcut Review | security-reviewer | cross-tenant negative tests, audit coverage | each merge | continuous |

**File-ownership rule**: one writer per file per active stream. Shared seams (`rbac/matrix.ts`, `repository.ts`, `engine/*`) are frozen as gates before S3 fan-out, so feature agents only consume them.

## M4 — Integrations + dispatch + lifecycle *(parallel where possible)*
- Dispatch glue `emitForEvent` (load workspace-scoped rules/alerts/prefs/members → evaluate → persist → fan out). Email (Resend, never-throws), Web Push (VAPID + dead-endpoint prune), analytics (PostHog, auth-only), all no-op when unconfigured.
- Per-workspace billing UI + seat cap from plan; PDF weekly report; per-user + per-workspace data export/delete; daily-digest option.

## Validation (per stream + global)
```bash
pnpm check-types      # tsc --noEmit — must stay green
pnpm lint             # biome check
pnpm build            # next build
# engines: unit tests (vitest) — pure evaluator/escalation/ics/time
# global acceptance (doc 06 checklist), highest priority:
#   - cross-tenant negative test: member of A cannot read/write B (MUST fail closed)
#   - signup creates+seeds workspace, signer=admin
#   - invite->accept flips membership active w/ role; email-binding rejects mismatch
#   - switching active workspace re-scopes data AND effective role
#   - every mutation writes workspace-scoped audit row w/ before/after diff
#   - workspace-local-time: task due "today" in workspace tz not prematurely overdue
#   - last-active-admin guard blocks demote/remove/deactivate/leave/transfer
#   - seat cap blocks invite over plan limit
```

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cross-tenant leak (missing workspace filter) | Med | Critical | Central enforcement in Repository only; forbid raw `db` in feature code (lint rule); mandatory negative test before any S3 merge |
| Better Auth org roles ≠ 4 domain roles cleanly | Med | High | Validate plugin access-control maps 4 roles in M0 spike before committing S1 |
| JSONB query weakness (dashboard/trends aggregations) | Med | Med | GIN/expression indexes on filtered fields; compute trends from bounded date ranges |
| Workspace-local-time correctness | Med | High | Time helpers pure + unit-tested with non-UTC tz; inject tz, never ambient clock |
| Engine semantics drift from spec | Low | High | Port thresholds verbatim; TDD against doc-05 cases before dispatch wiring |
| Scope (30+ screens) overrun | High | Med | Ship M0–M2 first; features independently mergeable; defer additive (PWA offline, trends) |
| Seat cap / last-admin race conditions | Med | High | SQL-level guard (conditional update/count), not app-level check-then-write |

## Acceptance (foundation milestone)
- [ ] `organization` plugin live; 4 roles enforced; active workspace in session
- [ ] 41 collections + audit_log migrated; user-global exceptions correct
- [ ] Generic Repository scopes every op by workspace_id + writes audit; cascades work
- [ ] RBAC matrices + 3 guards fail closed; row-level filters correct
- [ ] Membership lifecycle + last-admin + invite email-binding + seat cap
- [ ] Cross-tenant negative test passes; `pnpm check-types && pnpm lint && pnpm build` green

## Out of scope (this plan, defer)
PWA offline daily-log, read-access auditing (HIPAA extension), native push/APNs, multi-team within a workspace.
