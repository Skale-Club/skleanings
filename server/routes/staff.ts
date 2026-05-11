
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin, requireAuth } from "../lib/auth";
import { insertStaffMemberSchema } from "@shared/schema";
import { getAuthUrl, exchangeCodeForTokens, getStaffBusyTimes } from "../lib/google-calendar";

const router = Router();

const availabilityItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isAvailable: z.boolean(),
});

async function canManageStaffCalendar(req: any, staffId: number) {
  const user = req.user;
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "staff") return false;

  const member = await storage.getStaffMemberByUserId(user.id);
  return member?.id === staffId;
}

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
    const [staffIdStr, redirectTo] = state.split(":");
    const staffId = parseInt(staffIdStr, 10);

    if (!code || isNaN(staffId)) {
      return res.status(400).send("Invalid OAuth callback parameters");
    }

    await exchangeCodeForTokens(code, staffId);
    await storage.clearCalendarNeedsReconnect(staffId);
    res.redirect(redirectTo === "staff" ? "/staff/settings" : "/admin/staff");
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

// ─── Availability Overrides ────────────────────────────────────────────────────

const availabilityOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  isUnavailable: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  reason: z.string().nullable().optional(),
});

// GET /api/staff/:id/availability-overrides — list all overrides for a staff member
router.get("/:id/availability-overrides", requireAdmin, async (req, res) => {
  try {
    const overrides = await storage.getStaffAvailabilityOverrides(Number(req.params.id));
    res.json(overrides);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// POST /api/staff/:id/availability-overrides — create or replace an override for a date
router.post("/:id/availability-overrides", requireAdmin, async (req, res) => {
  try {
    const staffMemberId = Number(req.params.id);
    const body = availabilityOverrideSchema.parse(req.body);
    // Upsert: delete any existing override for same date, then insert
    const existing = await storage.getStaffAvailabilityOverridesByDate(staffMemberId, body.date);
    if (existing) {
      await storage.deleteStaffAvailabilityOverride(existing.id);
    }
    const override = await storage.createStaffAvailabilityOverride({
      staffMemberId,
      date: body.date,
      isUnavailable: body.isUnavailable,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      reason: body.reason ?? null,
    });
    res.status(201).json(override);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(400).json({ message: (err as Error).message });
  }
});

// DELETE /api/staff/:id/availability-overrides/:overrideId — remove a specific override
router.delete("/:id/availability-overrides/:overrideId", requireAdmin, async (req, res) => {
  try {
    await storage.deleteStaffAvailabilityOverride(Number(req.params.overrideId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// ─── Google Calendar OAuth ─────────────────────────────────────────────────────

// GET /api/staff/:id/calendar/busy?date=YYYY-MM-DD — GCal busy times for a date (cached)
router.get("/:id/calendar/busy", requireAdmin, async (req, res) => {
  try {
    const date = req.query.date;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });
    }
    const busyTimes = await getStaffBusyTimes(Number(req.params.id), date);
    res.json({ busyTimes });
  } catch (err) {
    res.json({ busyTimes: [] }); // fail gracefully — GCal overlay is best-effort
  }
});

// GET /api/staff/:id/calendar/status — connection state
router.get("/:id/calendar/status", requireAuth, async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    if (!(await canManageStaffCalendar(req, staffId))) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const record = await storage.getStaffGoogleCalendar(staffId);
    if (!record) return res.json({ connected: false, needsReconnect: false });
    res.json({ connected: !record.needsReconnect, calendarId: record.calendarId, connectedAt: record.connectedAt, needsReconnect: record.needsReconnect });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// GET /api/staff/:id/calendar/connect — initiate OAuth flow
router.get("/:id/calendar/connect", requireAuth, async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    if (!(await canManageStaffCalendar(req, staffId))) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const creds = await storage.getIntegrationSettings("google-calendar");
    if (!creds?.apiKey || !creds?.locationId) {
      return res.status(501).json({ message: "Google Calendar integration is not configured. Add credentials in Admin → Integrations." });
    }
    const user = (req as any).user;
    const redirectTo: "staff" | "admin" = user?.role === "staff" ? "staff" : "admin";
    const url = await getAuthUrl(staffId, redirectTo);
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// DELETE /api/staff/:id/calendar — disconnect Google Calendar
router.delete("/:id/calendar", requireAuth, async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    if (!(await canManageStaffCalendar(req, staffId))) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    await storage.deleteStaffGoogleCalendar(staffId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// POST /api/staff/:id/calendar/clear-reconnect — clear needsReconnect flag after re-auth
router.post("/:id/calendar/clear-reconnect", requireAuth, async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    if (!(await canManageStaffCalendar(req, staffId))) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    await storage.clearCalendarNeedsReconnect(staffId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

export default router;
