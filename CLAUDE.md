# indie

Next.js 15 SaaS starter. Stack: Next.js (App Router, Turbopack) · React 19 · TypeScript · Better Auth · Drizzle (Postgres) · Stripe · Biome.

## Commands

| Task | Command |
|------|---------|
| Dev server | `pnpm dev` (Turbopack; port 3000, falls back to 3001) |
| Build | `pnpm build` |
| Start (prod) | `pnpm start` |
| Lint/format | `pnpm lint` (`biome check`) |
| Typecheck | `pnpm check-types` (`tsc --noEmit`) |
| Test | `pnpm test` (vitest run) |
| Migrate | `set -a && . ./.env.local && set +a && npx drizzle-kit migrate` |

## Auth & payments

- Config: `src/lib/auth.ts` — Better Auth + Drizzle adapter (`pg`, plural tables) + Stripe plugin.
- DB schema: `src/database/schema.ts`. DB client: `src/database/db.ts`.
- Plans: `src/lib/payments/plans.ts`.

### Regenerate auth tables

CLI does **not** autoload `.env.local`. `src/lib/auth.ts` constructs Stripe at import time, so `STRIPE_SECRET_KEY` must be present or the CLI crashes. Run:

```bash
set -a && . ./.env.local && set +a && npx @better-auth/cli generate
```

Generates `auth-schema.ts` at root — merge tables into `src/database/schema.ts` (adapter reads from there) before migrating.

## Environment

Secrets in `.env.local` (template: `.env.example`). Next loads it automatically; standalone CLIs do not.

Sourcing note: `.env.local` may contain unquoted values (e.g. the Stripe key), so `set -a && . ./.env.local` prints a harmless `command not found` for that line — `DATABASE_URL` still exports. Prefer letting tooling read `.env.local` natively where possible.

## Database

- Migrations output to `migrations/` (gitignored — regenerated per environment). Generate with `npx drizzle-kit generate`, apply with the Migrate command above. Config: `drizzle.config.ts` (reads `DATABASE_URL`).
- Local dev: point `DATABASE_URL` at a local Postgres, e.g. `postgresql://<user>@localhost:5432/indie_dev` (`createdb indie_dev`), then run Migrate. The full schema is ~50 tables (45 JSONB domain collections + Better Auth tenancy + audit).
- Tenant isolation is enforced only in `src/lib/repository.ts` (every read/write auto-scoped by `workspace_id`). Feature code must go through the Repository — never touch a collection table or raw `db` directly.

## Scheduled jobs (Vercel Cron)

`vercel.json` defines crons hitting GET route handlers under `src/app/api/cron/`:

- `/api/cron/daily-digest` (13:00 UTC) — per-user overdue-tasks + open-alerts email digest.
- `/api/cron/visit-reminders` (14:00 UTC) — emails the care team about visits starting within 24h; deduped per (visit, member).

Both require `CRON_SECRET` (Vercel Cron sends it as `Authorization: Bearer …`); a request without the matching bearer is rejected (401), and an unset secret returns 503. Both sweeps never throw and no-op when email (`RESEND_API_KEY` + `EMAIL_FROM`) is unconfigured.

## Testing

- `pnpm test` runs vitest. Pure engine tests live in `src/lib/engine/*.test.ts`.
- The tenant-isolation integration test (`src/lib/repository.integration.test.ts`) hits real Postgres and is `describe.skipIf(!DATABASE_URL)` — so it only runs when a DB is present. Run it with the env sourced:

```bash
set -a && . ./.env.local && set +a && npx vitest run src/lib/repository.integration.test.ts
```
