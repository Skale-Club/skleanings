
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin, requireAuth } from "../lib/auth";
import { insertStaffMemberSchema } from "@shared/schema";
import { getAuthUrl, exchangeCodeForTokens } from "../lib/google-calendar";

const router = Router();

const availabilityItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isAvailable: z.boolean(),
});

// ─── Public endpoints (used by booking flow) ──────────────────────────────────

// GET /api/staff — list active staff members
router.get("/", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "1" || req.query.includeInactive === "true";
    const members = await storage.getStaffMembers(includeInactive);
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// GET /api/staff/calendar/all-statuses — all staff calendar connection state (must be before /:id)
router.get("/calendar/all-statuses", requireAdmin, async (_req, res) => {
  try {
    const statuses = await storage.getAllCalendarStatuses();
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// GET /api/staff/count — count of active staff (must be before /:id)
router.get("/count", async (_req, res) => {
  try {
    const count = await storage.getStaffCount();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// GET /api/staff/me — returns the logged-in staff's own staffMember record (must be before /:id)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const member = await storage.getStaffMemberByUserId(user.id);
    if (!member) return res.status(404).json({ message: "Staff profile not found" });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// PATCH /api/staff/me — update own profile (name, phone, bio, avatar)
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const member = await storage.getStaffMemberByUserId(user.id);
    if (!member) return res.status(404).json({ message: "Staff profile not found" });
    const { firstName, lastName, phone, bio, profileImageUrl } = req.body;
    const updated = await storage.updateStaffMember(member.id, {
      firstName: firstName ?? member.firstName,
      lastName: lastName ?? member.lastName,
      phone: phone ?? member.phone,
      bio: bio ?? member.bio,
      profileImageUrl: profileImageUrl ?? member.profileImageUrl,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// GET /api/staff/:id — get single staff member
router.get("/:id", async (req, res) => {
  try {
    const member = await storage.getStaffMember(Number(req.params.id));
    if (!member) return res.status(404).json({ message: "Staff member not found" });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// ─── Admin endpoints ───────────────────────────────────────────────────────────

// POST /api/staff — create staff member
router.post("/", requireAdmin, async (req, res) => {
  try {
    const data = insertStaffMemberSchema.parse(req.body);
    const member = await storage.createStaffMember(data);
    res.status(201).json(member);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(400).json({ message: (err as Error).message });
  }
});

// PUT /api/staff/reorder — reorder staff (must be before /:id)
router.put("/reorder", requireAdmin, async (req, res) => {
  try {
    const updates = z.array(z.object({ id: z.number(), order: z.number() })).parse(req.body.updates);
    await storage.reorderStaffMembers(updates);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(400).json({ message: (err as Error).message });
  }
});

// GET /api/staff/calendar/callback — OAuth callback (must be before /:id)
router.get("/calendar/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const staffId = parseInt(state, 10);

    if (!code || isNaN(staffId)) {
      return res.status(400).send("Invalid OAuth callback parameters");
    }

    await exchangeCodeForTokens(code, staffId);
    await storage.clearCalendarNeedsReconnect(staffId);
    res.redirect("/admin/staff");
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// PUT /api/staff/:id — update staff member
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const data = insertStaffMemberSchema.partial().parse(req.body);
    const member = await storage.updateStaffMember(Number(req.params.id), data);
    res.json(member);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(400).json({ message: (err as Error).message });
  }
});

// DELETE /api/staff/:id — delete staff member
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await storage.deleteStaffMember(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

// ─── Service abilities ─────────────────────────────────────────────────────────

// GET /api/staff/:id/services — get services this staff member can perform
router.get("/:id/services", async (req, res) => {
  try {
    const services = await storage.getServicesByStaffMember(Number(req.params.id));
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// PUT /api/staff/:id/services — replace service abilities
router.put("/:id/services", requireAdmin, async (req, res) => {
  try {
    const serviceIds = z.array(z.number()).parse(req.body.serviceIds);
    await storage.setStaffServiceAbilities(Number(req.params.id), serviceIds);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(400).json({ message: (err as Error).message });
  }
});

// ─── Availability schedule ─────────────────────────────────────────────────────

// GET /api/staff/:id/availability — get weekly availability
router.get("/:id/availability", async (req, res) => {
  try {
    const availability = await storage.getStaffAvailability(Number(req.params.id));
    res.json(availability);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// PUT /api/staff/:id/availability — replace weekly availability
router.put("/:id/availability", requireAdmin, async (req, res) => {
  try {
    const availability = z.array(availabilityItemSchema).parse(req.body);
    const saved = await storage.setStaffAvailability(Number(req.params.id), availability);
    res.json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(400).json({ message: (err as Error).message });
  }
});

// ─── Google Calendar OAuth ─────────────────────────────────────────────────────

// GET /api/staff/:id/calendar/status — connection state
router.get("/:id/calendar/status", requireAuth, async (req, res) => {
  try {
    const record = await storage.getStaffGoogleCalendar(Number(req.params.id));
    if (!record) return res.json({ connected: false, needsReconnect: false });
    res.json({ connected: !record.needsReconnect, calendarId: record.calendarId, connectedAt: record.connectedAt, needsReconnect: record.needsReconnect });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// GET /api/staff/:id/calendar/connect — initiate OAuth flow
router.get("/:id/calendar/connect", requireAuth, async (req, res) => {
  try {
    const creds = await storage.getIntegrationSettings("google-calendar");
    if (!creds?.apiKey || !creds?.locationId) {
      return res.status(501).json({ message: "Google Calendar integration is not configured. Add credentials in Admin → Integrations." });
    }
    const url = await getAuthUrl(Number(req.params.id));
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// DELETE /api/staff/:id/calendar — disconnect Google Calendar
router.delete("/:id/calendar", requireAuth, async (req, res) => {
  try {
    await storage.deleteStaffGoogleCalendar(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// POST /api/staff/:id/calendar/clear-reconnect — clear needsReconnect flag after re-auth
router.post("/:id/calendar/clear-reconnect", requireAuth, async (req, res) => {
  try {
    await storage.clearCalendarNeedsReconnect(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

export default router;
