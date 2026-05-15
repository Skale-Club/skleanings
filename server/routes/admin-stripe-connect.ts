/**
 * Admin Stripe Connect routes — Phase 63
 *
 * Mounted at /api/admin (in server/routes.ts) AFTER resolveTenantMiddleware
 * so res.locals.tenant and res.locals.storage are populated.
 *
 * Endpoints:
 *   POST /api/admin/stripe/connect/onboard — create/resume Express account, return onboarding URL
 *   GET  /api/admin/stripe/status          — return current tenant's Connect state
 *   POST /api/admin/stripe/refresh         — sync capability flags from Stripe (admin returned before webhook)
 *
 * All endpoints gated by requireAdmin (session fast-path then Supabase JWT — Phase 45-01).
 */

import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { requireAdmin } from "../lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const adminStripeConnectRouter = Router();

// ─── POST /api/admin/stripe/connect/onboard ─────────────────────────────────
// Creates a new Stripe Express account on first call, then returns an AccountLink URL.
// Subsequent calls reuse the existing stripeAccountId and just mint a fresh AccountLink
// (Stripe AccountLinks are short-lived single-use URLs — admin may need a new one each visit).
adminStripeConnectRouter.post(
  "/stripe/connect/onboard",
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenant = res.locals.tenant;
    if (!tenant) return res.status(503).json({ message: "Tenant not resolved" });
    const storage = res.locals.storage;
    if (!storage) return res.status(503).json({ message: "Storage not available" });

    try {
      // 1. Look up existing account (idempotent — admin may restart onboarding mid-flow)
      let row = await storage.getTenantStripeAccount(tenant.id);
      let accountId = row?.stripeAccountId;

      // 2. If none exists, create new Express account FIRST, then persist BEFORE generating AccountLink.
      //    Persisting before the AccountLink call ensures we don't orphan a created Stripe account
      //    when the AccountLink request itself errors out.
      if (!accountId) {
        const adminEmail = req.session?.adminUser?.email;
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: adminEmail,
          metadata: { tenantId: String(tenant.id) },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });
        accountId = account.id;
        await storage.createTenantStripeAccount(tenant.id, accountId);
      }

      // 3. Generate fresh AccountLink (single-use, ~minutes lifetime)
      const baseUrl = process.env.SITE_URL ?? `https://${req.hostname}`;
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        return_url: `${baseUrl}/admin/payments?status=success`,
        refresh_url: `${baseUrl}/admin/payments?status=refresh`,
        type: "account_onboarding",
      });

      return res.json({ url: accountLink.url });
    } catch (err) {
      console.error("[admin/stripe/connect/onboard] Error:", err);
      return res.status(500).json({ message: "Failed to start Stripe onboarding" });
    }
  },
);

// ─── GET /api/admin/stripe/status ───────────────────────────────────────────
// Returns the current tenant's Connect connection state — never throws on "not connected".
adminStripeConnectRouter.get(
  "/stripe/status",
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenant = res.locals.tenant;
    if (!tenant) return res.status(503).json({ message: "Tenant not resolved" });
    const storage = res.locals.storage;
    if (!storage) return res.status(503).json({ message: "Storage not available" });

    try {
      const row = await storage.getTenantStripeAccount(tenant.id);
      if (!row) {
        return res.json({
          connected: false,
          stripeAccountId: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
        });
      }
      return res.json({
        connected: true,
        stripeAccountId: row.stripeAccountId,
        chargesEnabled: row.chargesEnabled,
        payoutsEnabled: row.payoutsEnabled,
        detailsSubmitted: row.detailsSubmitted,
      });
    } catch (err) {
      console.error("[admin/stripe/status] Error:", err);
      return res.status(500).json({ message: "Failed to fetch Stripe status" });
    }
  },
);

// ─── POST /api/admin/stripe/refresh ─────────────────────────────────────────
// Synchronously pulls the latest capability flags from Stripe and updates the DB row.
// Used when admin returns from Stripe-hosted onboarding before the account.updated webhook fires.
adminStripeConnectRouter.post(
  "/stripe/refresh",
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenant = res.locals.tenant;
    if (!tenant) return res.status(503).json({ message: "Tenant not resolved" });
    const storage = res.locals.storage;
    if (!storage) return res.status(503).json({ message: "Storage not available" });

    try {
      const row = await storage.getTenantStripeAccount(tenant.id);
      if (!row) {
        return res.status(404).json({ message: "No Stripe account connected" });
      }

      const account = await stripe.accounts.retrieve(row.stripeAccountId);
      const chargesEnabled = account.charges_enabled ?? false;
      const payoutsEnabled = account.payouts_enabled ?? false;
      const detailsSubmitted = account.details_submitted ?? false;

      await storage.updateTenantStripeAccount(tenant.id, {
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
      });

      return res.json({ chargesEnabled, payoutsEnabled, detailsSubmitted });
    } catch (err) {
      console.error("[admin/stripe/refresh] Error:", err);
      return res.status(500).json({ message: "Failed to refresh Stripe status" });
    }
  },
);

export default adminStripeConnectRouter;
