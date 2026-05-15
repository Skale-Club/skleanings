/**
 * Custom Domain admin routes — Phase 61
 * Mounted at /api/admin (inside resolveTenantMiddleware scope).
 * All routes guarded by requireAdmin and tenant-scoped via res.locals.storage.
 *
 * Endpoints:
 *   GET    /api/admin/domains              List current tenant's domains (token stripped)
 *   POST   /api/admin/domains              Register new custom hostname (returns verificationToken)
 *   POST   /api/admin/domains/:id/verify   Perform DNS TXT lookup at _xkedule.<hostname>
 *   DELETE /api/admin/domains/:id          Remove a non-primary domain
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { promises as dns } from "node:dns";
import { requireAdmin } from "../lib/auth";
import { invalidateTenantCache } from "../middleware/tenant";

export const adminDomainsRouter = Router();

const hostnameSchema = z
  .string()
  .min(3)
  .max(253)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Invalid hostname format");

// GET /api/admin/domains — list current tenant's domains
adminDomainsRouter.get("/domains", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const storage = res.locals.storage;
    const tenant = res.locals.tenant;
    if (!storage || !tenant) {
      res.status(503).json({ message: "Tenant not resolved" });
      return;
    }
    const domains = await storage.getDomainsForTenant(tenant.id);
    // Strip verificationToken from response — token is only revealed on POST create
    const safe = domains.map((d: any) => ({
      id: d.id,
      hostname: d.hostname,
      isPrimary: d.isPrimary,
      verified: d.verified,
      verifiedAt: d.verifiedAt,
      createdAt: d.createdAt,
    }));
    res.json({ domains: safe });
  } catch (err) {
    console.error("[admin/domains] GET error:", err);
    res.status(500).json({ message: "Failed to list domains" });
  }
});

// POST /api/admin/domains — register new (unverified) custom domain
adminDomainsRouter.post("/domains", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({ hostname: hostnameSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid hostname" });
    return;
  }
  const hostname = parsed.data.hostname.toLowerCase();

  // Reject the system reserved domain root — tenants must not register *.xkedule.com themselves
  if (hostname.endsWith(".xkedule.com") || hostname === "xkedule.com") {
    res.status(400).json({ message: "xkedule.com subdomains are reserved" });
    return;
  }

  try {
    const storage = res.locals.storage;
    const tenant = res.locals.tenant;
    if (!storage || !tenant) {
      res.status(503).json({ message: "Tenant not resolved" });
      return;
    }
    const { id, verificationToken } = await storage.addDomainWithVerification(tenant.id, hostname);
    res.status(201).json({
      id,
      hostname,
      verificationToken,
      instructions: {
        recordType: "TXT",
        recordName: `_xkedule.${hostname}`,
        recordValue: verificationToken,
        message: `Add this TXT record at your DNS provider, then click "Verify".`,
      },
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ message: "Domain already registered" });
      return;
    }
    console.error("[admin/domains] POST error:", err);
    res.status(500).json({ message: "Failed to register domain" });
  }
});

// POST /api/admin/domains/:id/verify — perform DNS TXT lookup
adminDomainsRouter.post("/domains/:id/verify", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid domain id" });
    return;
  }

  const storage = res.locals.storage;
  const tenant = res.locals.tenant;
  if (!storage || !tenant) {
    res.status(503).json({ message: "Tenant not resolved" });
    return;
  }
  const domain = await storage.findDomainById(id, tenant.id);
  if (!domain) {
    res.status(404).json({ message: "Domain not found" });
    return;
  }
  if (domain.verified) {
    res.json({ verified: true, alreadyVerified: true });
    return;
  }
  if (!domain.verificationToken) {
    // Defensive: primary domains created pre-Phase-61 may not have a token
    res.status(400).json({ verified: false, message: "Domain has no verification token" });
    return;
  }

  try {
    const records = await dns.resolveTxt(`_xkedule.${domain.hostname}`);
    const flat = records.flat();
    if (flat.includes(domain.verificationToken)) {
      await storage.verifyDomain(id, tenant.id);
      invalidateTenantCache(domain.hostname);
      res.json({ verified: true });
      return;
    }
    res.status(400).json({
      verified: false,
      message: "TXT record found but token did not match. Double-check the record value.",
    });
  } catch (err: any) {
    if (err?.code === "ENOTFOUND" || err?.code === "ENODATA") {
      res.status(400).json({
        verified: false,
        message: "DNS record not found. Wait a few minutes for DNS propagation and try again.",
      });
      return;
    }
    console.error("[admin/domains] verify DNS lookup failed:", err);
    res.status(500).json({ verified: false, message: "DNS lookup failed" });
  }
});

// DELETE /api/admin/domains/:id — remove a non-primary domain
adminDomainsRouter.delete("/domains/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "Invalid domain id" });
    return;
  }
  try {
    const storage = res.locals.storage;
    const tenant = res.locals.tenant;
    if (!storage || !tenant) {
      res.status(503).json({ message: "Tenant not resolved" });
      return;
    }
    const result = await storage.removeDomainForTenant(id, tenant.id);
    if (!result.removed && !result.isPrimary) {
      res.status(404).json({ message: "Domain not found" });
      return;
    }
    if (!result.removed && result.isPrimary) {
      res.status(409).json({ message: "Cannot remove primary domain" });
      return;
    }
    invalidateTenantCache(result.hostname);
    res.json({ message: "Domain removed" });
  } catch (err) {
    console.error("[admin/domains] DELETE error:", err);
    res.status(500).json({ message: "Failed to remove domain" });
  }
});

export default adminDomainsRouter;
