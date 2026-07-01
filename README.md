<div align="center">
  <img src="public/logo.svg" alt="IndieSaas Starter Logo" width="80" height="80">
  <h1 style="color: #6d28d9; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 42px; text-align: center; margin: 20px 0 0 0;">
    IndieSaas Starter
  </h1>
</div>


A modern, Next.js Saas boilerplate with comprehensive authentication built on Better Auth, featuring a beautiful UI with shadcn/ui components and a robust tech stack.

## Tech Stack

- **Better Auth UI** - Pre-built authentication components
- **shadcn/ui** - Beautiful, accessible component library
- **Stripe** - Payment Provider
- **Biome** - Fast linter and formatter
- **Turborepo** - Monorepo build system
- **PostgreSQL** - Robust, production-ready database
- **Drizzle ORM** - Type-safe database queries
- **UploadThing** - Modern file uploads with built-in storage
- **Resend** - Transactional email service


## Roadmap

- [x] landing page
- [x] Authentication with Better Auth
- [x] Dashboard
- [x] Stripe Payment




##  Quick start

### 1. Clone the Repository
```bash
git clone https://github.com/indieceo/Indiesaas
cd indiesaas
```

### 2. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 3. Environment Setup
Copy `.env.example` to `.env.local` and update the variables.

```bash
cp .env.example .env.local
```

### 4. Database Setup
Create a database and run migrations. The standalone CLIs do **not** autoload `.env.local`, and `src/lib/auth.ts` builds the Stripe client at import time — so source the env first (this exports `DATABASE_URL` and `STRIPE_SECRET_KEY`):

```bash
# Local Postgres, once
createdb indie_dev   # then set DATABASE_URL=postgresql://<user>@localhost:5432/indie_dev in .env.local

# Generate Better Auth schema (merge auth-schema.ts into src/database/schema.ts)
set -a && . ./.env.local && set +a && npx @better-auth/cli generate

# Generate + apply Drizzle migrations (output dir migrations/ is gitignored)
set -a && . ./.env.local && set +a && npx drizzle-kit generate
set -a && . ./.env.local && set +a && npx drizzle-kit migrate
```

### 5. Start Development Server
```bash
npm run dev
# or
pnpm dev
```

##  Project Structure

Key configuration and structure files:

```
src/
├── app/                    # Next.js app directory
│   ├── (marketing)/       # Marketing pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard pages
│   └── api/               # API routes
├── components/            # React components
│   ├── layout/           # Layout components
│   └── ui/               # shadcn/ui components
├── config/
│   └── site.ts           # Site configuration
├── lib/
│   ├── auth.ts           # Better Auth configuration
│   └── payments/         # Stripe payment logic
├── database/
│   ├── db.ts             # Database connection
│   └── schema.ts         # Database schema
└── styles/               # Global styles

drizzle.config.ts         # Drizzle ORM configuration
next.config.ts            # Next.js configuration
biome.json                # Biome linter/formatter config
```


## Testing

```bash
pnpm test   # vitest run — pure engine tests in src/lib/engine/*.test.ts
```

The tenant-isolation integration test (`src/lib/repository.integration.test.ts`) exercises real Postgres and is skipped unless `DATABASE_URL` is set:

```bash
set -a && . ./.env.local && set +a && npx vitest run src/lib/repository.integration.test.ts
```

## Scheduled Jobs

`vercel.json` registers Vercel Cron jobs that hit GET route handlers under `src/app/api/cron/` (daily digest, visit reminders). They authenticate via a `CRON_SECRET` bearer token, never throw, and no-op when email (`RESEND_API_KEY` + `EMAIL_FROM`) is unconfigured.

## Usage

Feel free to use and customize this template as per your requirements. You can modify the components, styles, and content to create your unique website.

## License

This project is licensed under the MIT License. You are free to use, modify, and distribute it as you wish.

## 🙏 Credits


- [Better Auth Ui](https://better-auth-ui.com) - Pre-built authentication components
- [shadcn landing page](https://github.com/nobruf/shadcn-landing-page) - landing page used for this project



---

<div align="center">
  <a href="https://indietech.dev/?utm_source=github&utm_campaign=indiesaas" target="_blank">
    <img src="https://indietech.dev/logo.svg" alt="IndieTech Logo" width="32" height="32">
  </a>
  <p>
    Visit <strong><a href="https://indietech.dev/?utm_source=github&utm_campaign=indiesaas">IndieTech.dev</a></strong> <br/> for more on our products and services.
  </p>
</div>
