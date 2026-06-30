import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization } from "better-auth/plugins"
import { stripe } from "@better-auth/stripe"
import { ac, type RoleId, roles } from "@/lib/rbac/access"
import {
    guardInviteSeat,
    guardRemoveMember,
    guardRoleChange
} from "@/lib/workspace/lifecycle"
import { seedWorkspace } from "@/lib/workspace/seed"
import Stripe from "stripe"
import { headers } from "next/headers"
import { Resend } from "resend"
import { EmailTemplate } from "@daveyplate/better-auth-ui/server"
import React from "react"
import { db } from "@/database/db"
import * as schema from "@/database/schema"
import { type Plan, plans } from "@/lib/payments/plans"
import { site } from "@/config/site"

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-08-27.basil",
    typescript: true
})

const resend = new Resend(process.env.RESEND_API_KEY)

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        usePlural: true,
        schema
    }),
    emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url, token }, request) => {
            const name = user.name || user.email.split("@")[0]

            await resend.emails.send({
                from: site.mailFrom,
                to: user.email,
                subject: "Reset your password",
                react: EmailTemplate({
                    heading: "Reset your password",
                    content: React.createElement(
                        React.Fragment,
                        null,
                        React.createElement("p", null, `Hi ${name},`),
                        React.createElement(
                            "p",
                            null,
                            "Someone requested a password reset for your account. If this was you, ",
                            "click the button below to reset your password."
                        ),
                        React.createElement(
                            "p",
                            null,
                            "If you didn't request this, you can safely ignore this email."
                        )
                    ),
                    action: "Reset Password",
                    url,
                    siteName: site.name,
                    baseUrl: site.url,
                    imageUrl: `${site.url}/logo.png` // svg are not supported by resend
                })
            })
        }
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string
        },
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
        },
        twitter: {
            clientId: process.env.TWITTER_CLIENT_ID as string,
            clientSecret: process.env.TWITTER_CLIENT_SECRET as string
        }
    },
    plugins: [
        // Workspace = organization; membership = member(role); invite = invitation.
        // The session's activeOrganizationId is the active workspace; the effective
        // role is the active membership's role. Seat cap, last-active-admin guards,
        // and per-workspace seeding are layered on in M1.
        organization({
            ac,
            roles,
            creatorRole: "admin",
            organizationHooks: {
                // A fresh workspace is seeded with product content so it's usable
                // on day one (per-workspace, idempotent). Self-signup completes in
                // the onboarding flow by creating an organization, which fires this.
                afterCreateOrganization: async ({ organization }) => {
                    await seedWorkspace(organization.id)
                },
                // Last-active-admin protection: block removing/deactivating/leaving
                // or demoting the workspace's final admin.
                beforeRemoveMember: async ({ member, organization }) => {
                    await guardRemoveMember(organization.id, member.userId)
                },
                beforeUpdateMemberRole: async ({
                    member,
                    newRole,
                    organization
                }) => {
                    await guardRoleChange(
                        organization.id,
                        member.userId,
                        newRole as RoleId
                    )
                },
                // Per-plan member seat cap, enforced at invite time.
                beforeCreateInvitation: async ({ organization }) => {
                    await guardInviteSeat(organization.id)
                }
            }
        }),
        stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
            createCustomerOnSignUp: true,
            subscription: {
                enabled: true,
                plans: plans,
                getCheckoutSessionParams: async ({ user, plan }) => {
                    const checkoutSession: {
                        params: {
                            subscription_data?: {
                                trial_period_days: number
                            }
                        }
                    } = {
                        params: {}
                    }

                    if (user.trialAllowed) {
                        checkoutSession.params.subscription_data = {
                            trial_period_days: (plan as Plan).trialDays
                        }
                    }

                    return checkoutSession
                },
                onSubscriptionComplete: async ({ event }) => {
                    const eventDataObject = event.data
                        .object as Stripe.Checkout.Session
                    const userId = eventDataObject.metadata?.userId
                }
            }
        })
    ]
})

export async function getActiveSubscription() {
    const nextHeaders = await headers()
    const subscriptions = await auth.api.listActiveSubscriptions({
        headers: nextHeaders
    })
    return subscriptions.find((s) => s.status === "active")
}
