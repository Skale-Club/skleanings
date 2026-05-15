import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import Stripe from "stripe";
import { and, asc, count, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "../db";
import { bookings, contacts, domains, services, staffMembers, tenantSubscriptions, tenants } from "@shared/schema";
import { collectRuntimeEnvDiagnostics } from "../lib/runtime-env";
import { getRecentErrors } from "../lib/error-log";
import { storage } from "../storage";
import { invalidateTenantCache } from "../middleware/tenant";
import { getPriceIdForTier, isPlanTier, type PlanTier } from "../lib/stripe-plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const router = Router();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.superAdmin?.authenticated === true) {
    next();
    return;
  }
  res.status(403).json({ message: "Super-admin access required" });
}

// ---------------------------------------------------------------------------
// POST /login  — timing-safe credential check
// ---------------------------------------------------------------------------

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  const expectedEmail = process.env.SUPER_ADMIN_EMAIL;
  const expectedHash = process.env.SUPER_ADMIN_PASSWORD_HASH;

  if (!email || !password || !expectedEmail || !expectedHash) {
    res.status(403).json({ message: "Invalid credentials" });
    return;
  }

  // Timing-safe: bcrypt.compare ALWAYS runs regardless of email match
  const [emailMatch, hashMatch] = await Promise.all([
    Promise.resolve(email.toLowerCase() === expectedEmail.toLowerCase()),
    bcrypt.compare(password, expectedHash),
  ]);

  if (!emailMatch || !hashMatch) {
    res.status(403).json({ message: "Invalid credentials" });
    return;
  }

  req.session.superAdmin = { authenticated: true };
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------

router.post("/logout", (req: Request, res: Response): void => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ---------------------------------------------------------------------------
// GET /me  — public session check (no requireSuperAdmin)
// ---------------------------------------------------------------------------

router.get("/me", (req: Request, res: Response): void => {
  if (req.session.superAdmin?.authenticated === true) {
    res.json({ authenticated: true });
  } else {
    res.status(403).json({ authenticated: false });
  }
});

// ---------------------------------------------------------------------------
// GET /stats  — aggregate platform metrics
// ---------------------------------------------------------------------------

router.get("/stats", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      [bookingsRow],
      [contactsRow],
      [servicesRow],
      [staffRow],
    ] = await Promise.all([
      db.select({ count: count() }).from(bookings),
      db.select({ count: count() }).from(contacts),
      db.select({ count: count() }).from(services).where(eq(services.isArchived, false)),
      db.select({ count: count() }).from(staffMembers).where(eq(staffMembers.isActive, true)),
    ]);

    res.json({
      totalBookings: Number(bookingsRow?.count ?? 0),
      totalContacts: Number(contactsRow?.count ?? 0),
      totalServices: Number(servicesRow?.count ?? 0),
      totalStaff: Number(staffRow?.count ?? 0),
      serverUptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (err) {
    console.error("[super-admin] /stats error:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// ---------------------------------------------------------------------------
// GET /health  — database + env diagnostics
// ---------------------------------------------------------------------------

router.get("/health", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  let dbConnected = false;
  try {
    await ensureDatabaseReady();
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  let migrationCount = 0;
  try {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    migrationCount = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).length;
  } catch {
    migrationCount = 0;
  }

  const { errors, warnings } = collectRuntimeEnvDiagnostics();

  res.json({
    dbConnected,
    migrationCount,
    envErrors: errors,
    envWarnings: warnings,
  });
});

// ---------------------------------------------------------------------------
// GET /company-settings
// ---------------------------------------------------------------------------

router.get("/company-settings", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await storage.getCompanySettings();
    res.json(settings);
  } catch (err) {
    console.error("[super-admin] /company-settings GET error:", err);
    res.status(500).json({ message: "Failed to fetch company settings" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /company-settings
// ---------------------------------------------------------------------------

router.patch("/company-settings", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await storage.updateCompanySettings(req.body);
    res.json(updated);
  } catch (err) {
    console.error("[super-admin] /company-settings PATCH error:", err);
    res.status(500).json({ message: "Failed to update company settings" });
  }
});

// ---------------------------------------------------------------------------
// GET /error-logs  — recent captured console.error entries
// ---------------------------------------------------------------------------

router.get("/error-logs", requireSuperAdmin, (_req: Request, res: Response): void => {
  res.json(getRecentErrors());
});

// ---------------------------------------------------------------------------
// GET /tenants  — list all tenants with primary domain (LEFT JOIN, no N+1)
// ---------------------------------------------------------------------------

router.get("/tenants", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        createdAt: tenants.createdAt,
        primaryDomain: domains.hostname,
        // Phase 49: billing columns from tenant_subscriptions (LEFT JOIN — may be null if row missing)
        billingStatus: tenantSubscriptions.status,
        billingPlanId: tenantSubscriptions.planId,
        billingCurrentPeriodEnd: tenantSubscriptions.currentPeriodEnd,
      })
      .from(tenants)
      .leftJoin(domains, and(eq(domains.tenantId, tenants.id), eq(domains.isPrimary, true)))
      .leftJoin(tenantSubscriptions, eq(tenantSubscriptions.tenantId, tenants.id))
      .orderBy(asc(tenants.createdAt));

    const [bookingCounts, serviceCounts, staffCounts] = await Promise.all([
      db
        .select({ tenantId: bookings.tenantId, cnt: count() })
        .from(bookings)
        .groupBy(bookings.tenantId),
      db
        .select({ tenantId: services.tenantId, cnt: count() })
        .from(services)
        .where(eq(services.isArchived, false))
        .groupBy(services.tenantId),
      db
        .select({ tenantId: staffMembers.tenantId, cnt: count() })
        .from(staffMembers)
        .where(eq(staffMembers.isActive, true))
        .groupBy(staffMembers.tenantId),
    ]);

    const bMap = Object.fromEntries(bookingCounts.map(r => [r.tenantId, Number(r.cnt)]));
    const sMap = Object.fromEntries(serviceCounts.map(r => [r.tenantId, Number(r.cnt)]));
    const stMap = Object.fromEntries(staffCounts.map(r => [r.tenantId, Number(r.cnt)]));

    const result = rows.map(t => ({
      ...t,
      bookingCount: bMap[t.id] ?? 0,
      serviceCount: sMap[t.id] ?? 0,
      staffCount: stMap[t.id] ?? 0,
    }));

    res.json(result);
  } catch (err) {
    console.error("[super-admin] /tenants GET error:", err);
    res.status(500).json({ message: "Failed to fetch tenants" });
  }
});

// ---------------------------------------------------------------------------
// POST /tenants  — create tenant + primary domain row
// ---------------------------------------------------------------------------

router.post("/tenants", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name, slug, primaryDomain } = req.body as {
    name?: string;
    slug?: string;
    primaryDomain?: string;
  };

  if (!name?.trim() || !slug?.trim() || !primaryDomain?.trim()) {
    res.status(400).json({ message: "name, slug, and primaryDomain are required" });
    return;
  }

  // Normalize hostname: strip protocol and trailing slash
  const hostname = primaryDomain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!hostname) {
    res.status(400).json({ message: "Invalid primaryDomain format" });
    return;
  }

  try {
    const tenant = await storage.createTenant({ name: name.trim(), slug: slug.trim() });
    const domain = await storage.addDomain(tenant.id, hostname, true);
    await storage.seedTenantCompanySettings(tenant.id, name.trim());

    // Phase 48: Create Stripe customer and subscription tracking row
    try {
      const customer = await stripe.customers.create({
        name: name.trim(),
        metadata: { tenantId: String(tenant.id) },
      });
      await storage.createTenantSubscription(tenant.id, customer.id);
    } catch (stripeErr) {
      console.error("[super-admin] Stripe customer creation failed for tenant", tenant.id, stripeErr);
      // Non-fatal: tenant is created, subscription row will be missing until backfilled
    }

    res.status(201).json({ ...tenant, primaryDomain: domain.hostname });
  } catch (err: unknown) {
    if ((err as any)?.code === "23505") {
      const msg = (err as any)?.message ?? "";
      if (msg.includes("hostname")) {
        res.status(409).json({ message: "Hostname already registered" });
      } else {
        res.status(409).json({ message: "Slug already taken" });
      }
      return;
    }
    console.error("[super-admin] /tenants POST error:", err);
    res.status(500).json({ message: "Failed to create tenant" });
  }
});

// ---------------------------------------------------------------------------
// POST /tenants/:id/subscribe  — create Stripe Subscription for a tenant (Phase 48)
// ---------------------------------------------------------------------------

router.post("/tenants/:id/subscribe", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid tenant id" });
    return;
  }

  const priceId = process.env.STRIPE_SAAS_PRICE_ID;
  if (!priceId) {
    res.status(500).json({ message: "STRIPE_SAAS_PRICE_ID is not configured" });
    return;
  }

  try {
    const sub = await storage.getTenantSubscription(id);
    if (!sub) {
      res.status(404).json({ message: "No subscription record found for this tenant — ensure tenant was created via POST /tenants" });
      return;
    }

    const stripeSub = await stripe.subscriptions.create({
      customer: sub.stripeCustomerId,
      items: [{ price: priceId }],
    });

    // Note: Stripe SDK v21 TypeScript types dropped current_period_end from the
    // Subscription interface (API v2026+ billing model change). The field still
    // exists at runtime; cast to any to access it without a TS error.
    const periodEnd = (stripeSub as any).current_period_end as number | undefined;
    const updated = await storage.upsertTenantSubscription(id, {
      stripeSubscriptionId: stripeSub.id,
      status: stripeSub.status,
      planId: stripeSub.items.data[0]?.price.id ?? priceId,
      currentPeriodEnd: periodEnd != null ? new Date(periodEnd * 1000) : null,
    });

    res.status(200).json(updated);
  } catch (err: unknown) {
    console.error("[super-admin] /tenants/:id/subscribe error:", err);
    res.status(500).json({ message: "Failed to create subscription" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /tenants/:id/plan  — change a tenant's plan tier (Phase 59, PT-05)
// ---------------------------------------------------------------------------
// 1. Validate planTier via isPlanTier (basic | pro | enterprise)
// 2. Resolve target Stripe Price ID via getPriceIdForTier (500 if unset)
// 3. Look up tenant's subscription row (404 if missing stripeSubscriptionId)
// 4. Update the subscription item to the new price, with create_prorations
// 5. Persist planTier + planId in tenant_subscriptions (optimistic — the
//    customer.subscription.updated webhook will eventually arrive and
//    confirm the same state, which is idempotent thanks to the where-tenant_id filter)
// ---------------------------------------------------------------------------

router.patch("/tenants/:id/plan", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid tenant id" });
    return;
  }

  const { planTier } = req.body as { planTier?: unknown };
  if (!isPlanTier(planTier)) {
    res.status(400).json({ message: "Invalid plan tier — must be 'basic', 'pro', or 'enterprise'" });
    return;
  }

  const newPriceId = getPriceIdForTier(planTier);
  if (!newPriceId) {
    res.status(500).json({ message: `Price ID for ${planTier} tier is not configured (set STRIPE_SAAS_PRICE_ID_${planTier.toUpperCase()})` });
    return;
  }

  try {
    const subRow = await storage.getTenantSubscription(id);
    if (!subRow?.stripeSubscriptionId) {
      res.status(404).json({ message: "Tenant has no active Stripe subscription — call POST /tenants/:id/subscribe first" });
      return;
    }

    // Fetch current subscription to find the item id we need to swap
    const stripeSub = await stripe.subscriptions.retrieve(subRow.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) {
      res.status(500).json({ message: "Stripe subscription has no items — manual intervention required" });
      return;
    }

    // Swap the price with prorations enabled so the tenant is charged/credited
    // the difference for the remaining billing period.
    await stripe.subscriptions.update(subRow.stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "create_prorations",
    });

    // Optimistic DB update — webhook will arrive and confirm the same state.
    // We update both planTier and planId so the row is consistent immediately;
    // currentPeriodEnd/status will be refreshed by the eventual webhook.
    const updated = await storage.upsertTenantSubscription(id, {
      planTier,
      planId: newPriceId,
    });

    res.status(200).json({ message: "Plan updated", planTier, subscription: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[super-admin] PATCH /tenants/:id/plan error:", message);
    res.status(500).json({ message: "Failed to update plan tier" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /tenants/:id/status  — toggle active/inactive
// ---------------------------------------------------------------------------

router.patch("/tenants/:id/status", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body as { status?: string };

  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid tenant id" });
    return;
  }
  if (status !== "active" && status !== "inactive") {
    res.status(400).json({ message: "status must be 'active' or 'inactive'" });
    return;
  }

  try {
    const updated = await storage.updateTenantStatus(id, status);
    res.json(updated);
  } catch (err) {
    console.error("[super-admin] /tenants/:id/status PATCH error:", err);
    res.status(500).json({ message: "Failed to update tenant status" });
  }
});

// ---------------------------------------------------------------------------
// GET /tenants/:id/domains  — list all domains for a tenant
// ---------------------------------------------------------------------------

router.get("/tenants/:id/domains", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid tenant id" });
    return;
  }
  try {
    const domainList = await storage.getTenantDomains(id);
    res.json(domainList);
  } catch (err) {
    console.error("[super-admin] /tenants/:id/domains GET error:", err);
    res.status(500).json({ message: "Failed to fetch domains" });
  }
});

// ---------------------------------------------------------------------------
// POST /tenants/:id/domains  — add non-primary domain to a tenant
// ---------------------------------------------------------------------------

router.post("/tenants/:id/domains", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const tenantId = parseInt(req.params.id, 10);
  const { hostname: rawHostname } = req.body as { hostname?: string };

  if (isNaN(tenantId)) {
    res.status(400).json({ message: "Invalid tenant id" });
    return;
  }
  if (!rawHostname?.trim()) {
    res.status(400).json({ message: "hostname is required" });
    return;
  }

  // Normalize: strip protocol and trailing slash
  const hostname = rawHostname.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!hostname) {
    res.status(400).json({ message: "Invalid hostname format" });
    return;
  }

  try {
    const domain = await storage.addDomain(tenantId, hostname, false);
    invalidateTenantCache(hostname);
    res.status(201).json(domain);
  } catch (err: unknown) {
    if ((err as any)?.code === "23505") {
      res.status(409).json({ message: "Hostname already registered" });
      return;
    }
    console.error("[super-admin] /tenants/:id/domains POST error:", err);
    res.status(500).json({ message: "Failed to add domain" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /domains/:id  — remove non-primary domain
// ---------------------------------------------------------------------------

router.delete("/domains/:id", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid domain id" });
    return;
  }

  // Fetch first to guard primary domain deletion
  const [domain] = await db.select().from(domains).where(eq(domains.id, id));
  if (!domain) {
    res.status(404).json({ message: "Domain not found" });
    return;
  }
  if (domain.isPrimary) {
    res.status(400).json({ message: "Cannot remove primary domain" });
    return;
  }

  try {
    await storage.removeDomain(id);
    invalidateTenantCache(domain.hostname);
    res.status(204).send();
  } catch (err) {
    console.error("[super-admin] /domains/:id DELETE error:", err);
    res.status(500).json({ message: "Failed to remove domain" });
  }
});

// ---------------------------------------------------------------------------
// POST /tenants/:id/provision  — create initial admin user for a tenant
// ---------------------------------------------------------------------------

router.post("/tenants/:id/provision", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const tenantId = parseInt(req.params.id, 10);
  const { email } = req.body as { email?: string };

  if (isNaN(tenantId)) {
    res.status(400).json({ message: "Invalid tenant id" });
    return;
  }
  if (!email?.trim()) {
    res.status(400).json({ message: "email is required" });
    return;
  }

  // Cryptographically secure random 16-char password
  const plainPassword = randomBytes(10).toString("base64url").slice(0, 16);
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  try {
    const { userId } = await storage.provisionTenantAdmin(tenantId, email.trim(), hashedPassword);
    // Return cleartext password ONCE — it is not stored anywhere after this response
    res.status(201).json({ userId, email: email.trim(), password: plainPassword });
  } catch (err: unknown) {
    if ((err as any)?.code === "23505") {
      res.status(409).json({ message: "Email already registered" });
      return;
    }
    console.error("[super-admin] /tenants/:id/provision POST error:", err);
    res.status(500).json({ message: "Failed to provision admin" });
  }
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { router as superAdminRouter };
