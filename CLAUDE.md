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
