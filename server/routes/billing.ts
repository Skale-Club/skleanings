/**
 * Billing webhook handler — Phase 48
 *
 * IMPORTANT: This handler is mounted in server/index.ts BEFORE express.json()
 * using express.raw({ type: 'application/json' }). req.body is a Buffer here.
 * Do NOT add this router to registerRoutes() — it must bypass resolveTenantMiddleware.
 */

import { type Request, type Response, Router } from "express";
import Stripe from "stripe";
import { db } from "../db";
import { tenantSubscriptions, tenantStripeAccounts, users, companySettings } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { DatabaseStorage } from "../storage";
import { sendResendEmail } from "../lib/email-resend";
import { getTierForPriceId, isPlanTier, type PlanTier } from "../lib/stripe-plans";
import { getFeatureCatalog } from "../lib/feature-flags";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function billingWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({ message: "Missing stripe-signature header or STRIPE_WEBHOOK_SECRET" });
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body is a Buffer (express.raw middleware — raw body preserved)
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[billing/webhook] Signature verification failed:", message);
    res.status(400).json({ message: `Webhook signature verification failed: ${message}` });
    return;
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        // Look up tenant by stripeCustomerId — global registry, use db directly
        const [subRow] = await db
          .select()
          .from(tenantSubscriptions)
          .where(eq(tenantSubscriptions.stripeCustomerId, stripeCustomerId));

        if (!subRow) {
          console.warn("[billing/webhook] No tenant_subscriptions row for customer:", stripeCustomerId);
          // Acknowledge to Stripe — unknown customer is not a processing error
          res.status(200).json({ received: true });
          return;
        }

        const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
        // In Stripe SDK v21, current_period_end lives on SubscriptionItem, not Subscription
        const firstItem = sub.items.data[0];
        const periodEnd = firstItem?.current_period_end;
        const newPriceId = firstItem?.price.id ?? null;

        // PT-04: Reverse-lookup priceId -> planTier. If the price is unrecognized
        // (e.g. legacy STRIPE_SAAS_PRICE_ID not yet aliased to a tier env var),
        // we leave planTier untouched so we never overwrite valid state with null.
        const newTier = newPriceId ? getTierForPriceId(newPriceId) : null;
        if (newPriceId && !newTier) {
          console.warn(
            `[billing/webhook] Unrecognized price ID '${newPriceId}' for tenant ${subRow.tenantId} — planTier left unchanged`,
          );
        }

        await db
          .update(tenantSubscriptions)
          .set({
            stripeSubscriptionId: sub.id,
            status,
            planId: newPriceId,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            updatedAt: new Date(),
            ...(newTier ? { planTier: newTier } : {}),
          })
          .where(eq(tenantSubscriptions.tenantId, subRow.tenantId));

        console.log(`[billing/webhook] ${event.type} processed for tenant ${subRow.tenantId}, status=${status}`);

        // BH-02: Send dunning email when subscription becomes past_due (fire-and-forget, non-fatal)
        if (status === "past_due") {
          try {
            const tenantStorage = DatabaseStorage.forTenant(subRow.tenantId);

            const [adminUser] = await db
              .select({ email: users.email })
              .from(users)
              .where(and(eq(users.tenantId, subRow.tenantId), eq(users.role, "admin")))
              .limit(1);

            const [companySetting] = await db
              .select({ companyName: companySettings.companyName })
              .from(companySettings)
              .where(eq(companySettings.tenantId, subRow.tenantId))
              .limit(1);

            if (adminUser?.email) {
              const siteUrl = process.env.SITE_URL ?? "https://app.xkedule.com";
              const billingUrl = `${siteUrl}/admin/billing`;
              const companyName = companySetting?.companyName || "Your account";

              const subject = "Payment failed — your subscription is past due";
              const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Inter, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="font-family: Outfit, sans-serif; color: #1C53A3; margin-top: 0;">Payment failed</h2>
    <p style="color: #374151;">Hi there,</p>
    <p style="color: #374151;">We were unable to process the payment for your <strong>${companyName}</strong> subscription. Your account is currently <strong>past due</strong>.</p>
    <p style="color: #dc2626; font-weight: 600;">If payment is not updated within 3 days, your account will be suspended and your booking flow will become unavailable to customers.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${billingUrl}"
         style="background: #FFFF01; color: #000; font-weight: 700; font-family: Outfit, sans-serif;
                padding: 14px 32px; border-radius: 9999px; text-decoration: none; display: inline-block;">
        Update Payment Method
      </a>
    </div>
    <p style="color: #6b7280; font-size: 13px;">
      Or copy this link into your browser:<br />
      <a href="${billingUrl}" style="color: #1C53A3; word-break: break-all;">${billingUrl}</a>
    </p>
  </div>
</body>
</html>`;
              const text = `Payment failed for ${companyName}.\n\nUpdate your payment method to avoid service suspension: ${billingUrl}`;

              await sendResendEmail(
                tenantStorage,
                adminUser.email,
                subject,
                html,
                text,
                undefined,
                "past_due_dunning"
              );
              console.log(`[billing/webhook] past_due dunning email sent to ${adminUser.email} for tenant ${subRow.tenantId}`);
            }
          } catch (emailErr) {
            // Non-fatal — log and continue, webhook must still return 200
            console.error("[billing/webhook] past_due: failed to send dunning email:", emailErr);
          }
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const [subRow] = await db
          .select()
          .from(tenantSubscriptions)
          .where(eq(tenantSubscriptions.stripeCustomerId, stripeCustomerId));

        if (!subRow) {
          console.warn("[billing/webhook] trial_will_end: no tenant_subscriptions row for customer:", stripeCustomerId);
          res.status(200).json({ received: true });
          return;
        }

        const firstItem = sub.items.data[0];
        const periodEnd = firstItem?.current_period_end;

        await db
          .update(tenantSubscriptions)
          .set({
            status: sub.status,   // "trialing" — trial hasn't ended yet
            planId: firstItem?.price.id ?? null,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            updatedAt: new Date(),
          })
          .where(eq(tenantSubscriptions.tenantId, subRow.tenantId));

        console.warn(`[billing/webhook] trial_will_end: tenant ${subRow.tenantId} trial ending soon`);

        // BH-01: Send trial-ending warning email to tenant admin (fire-and-forget, non-fatal)
        try {
          const tenantStorage = DatabaseStorage.forTenant(subRow.tenantId);

          // Look up admin user for this tenant
          const [adminUser] = await db
            .select({ email: users.email })
            .from(users)
            .where(and(eq(users.tenantId, subRow.tenantId), eq(users.role, "admin")))
            .limit(1);

          // Look up company name from companySettings
          const [companySetting] = await db
            .select({ companyName: companySettings.companyName })
            .from(companySettings)
            .where(eq(companySettings.tenantId, subRow.tenantId))
            .limit(1);

          if (adminUser?.email) {
            const siteUrl = process.env.SITE_URL ?? "https://app.xkedule.com";
            const billingUrl = `${siteUrl}/admin/billing`;
            const companyName = companySetting?.companyName || "Your account";

            const subject = "Your trial ends in 3 days — add a payment method to continue";
            const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Inter, sans-serif; background: #f8fafc; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="font-family: Outfit, sans-serif; color: #1C53A3; margin-top: 0;">Your trial ends in 3 days</h2>
    <p style="color: #374151;">Hi there,</p>
    <p style="color: #374151;">Your <strong>${companyName}</strong> trial subscription expires in <strong>3 days</strong>. To keep your account active, please add a payment method before your trial ends.</p>
    <p style="color: #374151;">Without a payment method, your account will be suspended when the trial expires.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${billingUrl}"
         style="background: #FFFF01; color: #000; font-weight: 700; font-family: Outfit, sans-serif;
                padding: 14px 32px; border-radius: 9999px; text-decoration: none; display: inline-block;">
        Add Payment Method
      </a>
    </div>
    <p style="color: #6b7280; font-size: 13px;">
      Or copy this link into your browser:<br />
      <a href="${billingUrl}" style="color: #1C53A3; word-break: break-all;">${billingUrl}</a>
    </p>
  </div>
</body>
</html>`;
            const text = `Your ${companyName} trial ends in 3 days.\n\nAdd a payment method to keep your account active: ${billingUrl}`;

            await sendResendEmail(
              tenantStorage,
              adminUser.email,
              subject,
              html,
              text,
              undefined,
              "trial_will_end"
            );
            console.log(`[billing/webhook] trial_will_end: warning email sent to ${adminUser.email} for tenant ${subRow.tenantId}`);
          }
        } catch (emailErr) {
          // Non-fatal — log and continue, webhook must still return 200
          console.error("[billing/webhook] trial_will_end: failed to send warning email:", emailErr);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        // Look up by stripe_account_id — global registry, db directly (matches Phase 48 pattern).
        const [row] = await db
          .select()
          .from(tenantStripeAccounts)
          .where(eq(tenantStripeAccounts.stripeAccountId, account.id));

        if (!row) {
          // Unknown account — ack to Stripe but log. Avoids retry storms for accounts
          // belonging to other platforms or to tenants whose row was already deleted.
          console.warn("[billing/webhook] account.updated: no tenant_stripe_accounts row for account:", account.id);
          break;
        }

        await db
          .update(tenantStripeAccounts)
          .set({
            chargesEnabled: account.charges_enabled ?? false,
            payoutsEnabled: account.payouts_enabled ?? false,
            detailsSubmitted: account.details_submitted ?? false,
            updatedAt: new Date(),
          })
          .where(eq(tenantStripeAccounts.stripeAccountId, account.id));

        console.log(
          `[billing/webhook] account.updated processed for tenant ${row.tenantId}: ` +
            `charges=${account.charges_enabled} payouts=${account.payouts_enabled} details=${account.details_submitted}`,
        );
        break;
      }

      case "account.application.deauthorized": {
        // For account.application.deauthorized, event.data.object is a Stripe.Application
        // (the platform's OAuth app), NOT the connected account. The connected account ID
        // that revoked access lives on the top-level event.account field.
        const connectedAccountId = event.account;
        if (!connectedAccountId) {
          console.warn(
            "[billing/webhook] account.application.deauthorized: missing event.account — cannot resolve connected account",
          );
          break;
        }
        // Hard-delete the row — admin has revoked the platform's access. On reconnect they get
        // a brand new Express account (no resume). Matches Phase 57 invitation revoke hard-delete:
        // irreversible action -> remove the record.
        const result = await db
          .delete(tenantStripeAccounts)
          .where(eq(tenantStripeAccounts.stripeAccountId, connectedAccountId))
          .returning({ tenantId: tenantStripeAccounts.tenantId });

        if (result.length === 0) {
          console.warn(
            "[billing/webhook] account.application.deauthorized: no tenant_stripe_accounts row for account:",
            connectedAccountId,
          );
        } else {
          console.log(
            `[billing/webhook] account.application.deauthorized processed for tenant ${result[0].tenantId}`,
          );
        }
        break;
      }

      default:
        // Unhandled event types — acknowledge without processing
        break;
    }

    res.status(200).json({ received: true });
  } catch (err: unknown) {
    console.error("[billing/webhook] Processing error:", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
}

// ─── Billing self-service router — Phase 50 ─────────────────────────────────
// Mounted in registerRoutes() at /api/billing, AFTER resolveTenantMiddleware
// so res.locals.tenant and res.locals.storage are populated.

export const billingRouter = Router();

// GET /api/billing/status — returns current tenant's subscription row
// Protected by requireAdmin (session-based fast-path or Supabase JWT)
billingRouter.get("/status", requireAdmin, async (req, res) => {
  const tenant = res.locals.tenant;
  if (!tenant) return res.status(503).json({ message: "Tenant not resolved" });

  try {
    const sub = await res.locals.storage!.getTenantSubscription(tenant.id);
    if (!sub) {
      // New tenant — no subscription row yet
      return res.json({ status: "none", planId: null, currentPeriodEnd: null, stripeCustomerId: null });
    }
    // Normalize planTier: column is text + CHECK constraint, but be defensive.
    // Unrecognized / null values default to "basic" so the UI always has something to render.
    const tier: PlanTier = isPlanTier(sub.planTier) ? sub.planTier : "basic";
    return res.json({
      status: sub.status,
      planId: sub.planId,
      planTier: tier,
      features: getFeatureCatalog(tier),
      currentPeriodEnd: sub.currentPeriodEnd,
      stripeCustomerId: sub.stripeCustomerId,
    });
  } catch (err) {
    console.error("[billing/status] Error:", err);
    return res.status(500).json({ message: "Failed to fetch billing status" });
  }
});

// POST /api/billing/portal — creates Stripe Customer Portal session, returns { url }
// Protected by requireAdmin
billingRouter.post("/portal", requireAdmin, async (req, res) => {
  const tenant = res.locals.tenant;
  if (!tenant) return res.status(503).json({ message: "Tenant not resolved" });

  try {
    const sub = await res.locals.storage!.getTenantSubscription(tenant.id);
    if (!sub?.stripeCustomerId) {
      return res.status(404).json({ message: "No Stripe customer found for this tenant" });
    }

    const siteUrl = process.env.SITE_URL ?? `https://${req.hostname}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${siteUrl}/admin/billing`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("[billing/portal] Error:", err);
    return res.status(500).json({ message: "Failed to create billing portal session" });
  }
});

// GET /api/billing/invoices — returns last 10 Stripe invoices for this tenant
// Protected by requireAdmin
billingRouter.get("/invoices", requireAdmin, async (req, res) => {
  const tenant = res.locals.tenant;
  if (!tenant) return res.status(503).json({ message: "Tenant not resolved" });

  try {
    const sub = await res.locals.storage!.getTenantSubscription(tenant.id);
    if (!sub?.stripeCustomerId) {
      // Non-fatal: new tenant with no Stripe customer yet
      return res.json({ invoices: [] });
    }

    const invoiceList = await stripe.invoices.list({
      customer: sub.stripeCustomerId,
      limit: 10,
    });

    const invoices = invoiceList.data.map((inv) => ({
      id: inv.id,
      date: new Date(inv.created * 1000).toISOString(),
      amount: inv.amount_paid ?? inv.amount_due,
      currency: inv.currency,
      status: inv.status,   // "paid" | "open" | "void" | "draft" | "uncollectible"
      invoiceUrl: inv.hosted_invoice_url ?? null,
    }));

    return res.json({ invoices });
  } catch (err) {
    console.error("[billing/invoices] Error:", err);
    return res.status(500).json({ message: "Failed to fetch invoices" });
  }
});
