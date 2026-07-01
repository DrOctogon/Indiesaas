import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified")
        .$defaultFn(() => false)
        .notNull(),
    image: text("image"),
    avatar: text("avatar"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at")
        .$defaultFn(() => /* @__PURE__ */ new Date())
        .notNull(),
    updatedAt: timestamp("updated_at")
        .$defaultFn(() => /* @__PURE__ */ new Date())
        .notNull(),
    stripeCustomerId: text("stripe_customer_id")
})

export const sessions = pgTable("sessions", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id")
})

export const accounts = pgTable("accounts", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull()
})

export const verifications = pgTable("verifications", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").$defaultFn(
        () => /* @__PURE__ */ new Date()
    ),
    updatedAt: timestamp("updated_at").$defaultFn(
        () => /* @__PURE__ */ new Date()
    )
})

export const subscriptions = pgTable("subscriptions", {
    id: text("id").primaryKey(),
    plan: text("plan").notNull(),
    referenceId: text("reference_id").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: text("status").default("incomplete"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end"),
    seats: integer("seats"),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end")
})

// --- Better Auth organization plugin (tenancy) ---
// organization = workspace. Tenant root: every domain row's workspace_id -> organizations.id.
// The IANA timezone that drives all workspace-local-time logic lives inside `metadata` (json string).
export const organizations = pgTable("organizations", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata")
})

// member = membership (user, workspace, role). role is one of admin|caregiver|family|household.
// A user may hold different roles in different workspaces. UNIQUE(user, workspace) enforced by the plugin.
export const members = pgTable("members", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    // Deactivation flag (BUILD/06 invariant 9): a suspended member is reversible
    // (not a hard delete) and is excluded from the active-admin count. Better
    // Auth has no native suspended state, so it lives here and the lifecycle
    // guards read it via loadMembers.
    suspended: boolean("suspended").default(false).notNull(),
    createdAt: timestamp("created_at").notNull()
})

// invitation = pending membership (email + role + one-time token), TTL enforced by the plugin.
export const invitations = pgTable("invitations", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    inviterId: text("inviter_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" })
})

// HomeCare domain collections (JSONB-uniform) + audit_log. Re-exported here so
// drizzle-kit (schema path) and the Better Auth adapter (`import * as schema`)
// both register every domain table. Definitions live in ./collections.
export * from "./collections"
