import { Router } from "express";
import { requireAdmin } from "../lib/auth";
import { storage } from "../storage";

const router = Router();

// GET /api/conversations/:id/notifications
// Returns notification log rows for a specific conversation (admin only)
router.get("/conversations/:id/notifications", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await storage.getNotificationLogsByConversation(id);
    res.json(logs);
  } catch (err: any) {
    console.error("[notification-logs] Error fetching by conversation:", err);
    res.status(500).json({ error: "Failed to fetch notification logs" });
  }
});

// GET /api/admin/notification-logs
// Global paginated notification log with optional filters (admin only)
router.get("/admin/notification-logs", requireAdmin, async (req, res) => {
  try {
    const { channel, status, trigger, from, to, search, limit, offset } = req.query;

    const logs = await storage.getNotificationLogs({
      channel: channel as string | undefined,
      status: status as string | undefined,
      trigger: trigger as string | undefined,
      search: search as string | undefined,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json(logs);
  } catch (err: any) {
    console.error("[notification-logs] Error fetching global log:", err);
    res.status(500).json({ error: "Failed to fetch notification logs" });
  }
});

export default router;
