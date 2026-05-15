/**
 * Admin Payments routes — Phase 66
 *
 * Mounted at /api/admin (in server/routes.ts) AFTER resolveTenantMiddleware
 * so res.locals.tenant and res.locals.storage are populated.
 *
 * Endpoints:
 *   GET /api/admin/payments/recent — last N paid bookings for current tenant
 *
 * Gated by requireAdmin (session fast-path then Supabase JWT — Phase 45-01).
 */

import { Router, type Request, type Response } from "express";
import { requireAdmin } from "../lib/auth";

export const adminPaymentsRouter = Router();

// ─── GET /api/admin/payments/recent ─────────────────────────────────────────
// Returns the most recent paid bookings for the calling tenant.
// Query: ?limit=N (1..100, default 20). Response: { payments: [...] }
adminPaymentsRouter.get(
  "/payments/recent",
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenant = res.locals.tenant;
    if (!tenant) return res.status(503).json({ message: "Tenant not resolved" });
    const storage = res.locals.storage;
    if (!storage) return res.status(503).json({ message: "Storage not available" });

    try {
      const raw = parseInt(req.query.limit as string);
      const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 20;
      const payments = await storage.getRecentPaidBookings(limit);
      return res.json({ payments });
    } catch (err) {
      console.error("[admin/payments/recent] Error:", err);
      return res.status(500).json({ message: "Failed to fetch recent payments" });
    }
  },
);

export default adminPaymentsRouter;
