/**
 * POST /api/auth/signup — self-serve tenant signup (Phase 51, SS-01–SS-04)
 *
 * PUBLIC endpoint — mounted in routes.ts BEFORE resolveTenantMiddleware.
 * No res.locals.tenant or res.locals.storage available — uses storage singleton
 * which is DatabaseStorage.forTenant(1) but signupTenant() uses db directly (global registry).
 */

import { Router } from "express";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const signupSchema = z.object({
  companyName: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Subdomain may only contain lowercase letters, numbers, and hyphens",
    ),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export { signupSchema };

router.post("/auth/signup", async (req, res) => {
  // Parse and validate input
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return res.status(400).json({
      field: firstError.path[0] ?? "unknown",
      message: firstError.message,
    });
  }

  const { companyName, slug, email, password } = parsed.data;

  // Hash password before transaction
  const hashedPassword = await bcrypt.hash(password, 12);

  let tenantId: number;
  let userId: string;
  let subdomain: string;

  try {
    const result = await storage.signupTenant({
      companyName,
      slug,
      email,
      hashedPassword,
    });
    tenantId = result.tenantId;
    userId = result.userId;
    subdomain = result.subdomain;
  } catch (err: any) {
    if (err?.code === "SUBDOMAIN_TAKEN") {
      return res.status(409).json({
        field: "slug",
        message: "Subdomain already taken",
      });
    }
    // Postgres unique constraint on domains.hostname (belt-and-suspenders)
    if (err?.code === "23505" && err?.message?.includes("hostname")) {
      return res.status(409).json({
        field: "slug",
        message: "Subdomain already taken",
      });
    }
    // Postgres unique constraint on users.email
    if (err?.code === "23505" && err?.message?.includes("email")) {
      return res.status(409).json({
        field: "email",
        message: "An account with this email already exists",
      });
    }
    console.error("[auth/signup] signupTenant error:", err);
    return res.status(500).json({ message: "Signup failed. Please try again." });
  }

  // Stripe: create customer + 14-day trial subscription (non-fatal)
  try {
    const priceId = process.env.STRIPE_SAAS_PRICE_ID;
    if (!priceId) {
      console.warn(
        "[auth/signup] STRIPE_SAAS_PRICE_ID not set — skipping subscription creation",
      );
    } else {
      const customer = await stripe.customers.create({
        email,
        name: companyName,
        metadata: { tenantId: String(tenantId) },
      });

      const stripeSub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: 14,
      });

      const periodEnd = (stripeSub as any).current_period_end as
        | number
        | undefined;

      // createTenantSubscription inserts row; upsertTenantSubscription updates with sub details
      await storage.createTenantSubscription(tenantId, customer.id);
      await storage.upsertTenantSubscription(tenantId, {
        stripeSubscriptionId: stripeSub.id,
        status: stripeSub.status, // "trialing"
        planId: stripeSub.items.data[0]?.price.id ?? priceId,
        currentPeriodEnd:
          periodEnd != null ? new Date(periodEnd * 1000) : null,
      });
    }
  } catch (stripeErr) {
    console.error(
      "[auth/signup] Stripe setup failed for tenant",
      tenantId,
      stripeErr,
    );
    // Non-fatal: tenant exists, Stripe can be backfilled manually
  }

  // Set admin session so user lands in /admin already logged in
  req.session.adminUser = {
    id: userId,
    email,
    role: "admin",
    tenantId,
  };

  const adminUrl = `https://${subdomain}/admin`;
  return res.status(201).json({ subdomain, adminUrl });
});

export default router;
