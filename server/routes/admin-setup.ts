/**
 * Admin Setup Checklist routes — Phase 56
 * Mounted at /api/admin after resolveTenantMiddleware.
 * Uses res.locals.storage (tenant-scoped) for all queries.
 */
import { type Request, type Response, Router } from "express";
import { requireAdmin } from "../lib/auth";

export const adminSetupRouter = Router();

/**
 * GET /api/admin/setup-status
 * Returns live DB state for the setup checklist.
 * Response: { hasService: boolean, hasStaff: boolean, hasAvailability: boolean, dismissed: boolean }
 */
adminSetupRouter.get("/setup-status", requireAdmin, async (req: Request, res: Response) => {
  const storage = res.locals.storage;
  if (!storage) return res.status(503).json({ message: "Storage not available" });

  try {
    const [settings, services, staffCount, staffMembers] = await Promise.all([
      storage.getCompanySettings(),
      storage.getServices(undefined, undefined, true), // includeHidden=true for count purposes
      storage.getStaffCount(),
      storage.getStaffMembers(true), // includeInactive=true for availability check
    ]);

    // Check availability: any staff member has at least one availability row
    let hasAvailability = false;
    if (staffMembers.length > 0) {
      for (const member of staffMembers) {
        const avail = await storage.getStaffAvailability(member.id);
        if (avail.length > 0) {
          hasAvailability = true;
          break;
        }
      }
    }

    return res.json({
      hasService: services.length > 0,
      hasStaff: staffCount > 0,
      hasAvailability,
      dismissed: settings.setupDismissedAt != null,
    });
  } catch (err) {
    console.error("[admin-setup] GET /setup-status error:", err);
    return res.status(500).json({ message: "Failed to fetch setup status" });
  }
});

/**
 * POST /api/admin/setup-dismiss
 * Permanently dismisses the setup checklist by setting setupDismissedAt = now().
 * Response: { success: true }
 */
adminSetupRouter.post("/setup-dismiss", requireAdmin, async (req: Request, res: Response) => {
  const storage = res.locals.storage;
  if (!storage) return res.status(503).json({ message: "Storage not available" });

  try {
    await storage.updateCompanySettings({ setupDismissedAt: new Date() });
    return res.json({ success: true });
  } catch (err) {
    console.error("[admin-setup] POST /setup-dismiss error:", err);
    return res.status(500).json({ message: "Failed to dismiss setup checklist" });
  }
});
