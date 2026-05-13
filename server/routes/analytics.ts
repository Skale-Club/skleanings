import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage/index";
import { log } from "../lib/logger";
import { requireAdmin } from "../lib/auth";
import { getOverviewData, getSourcesData, getCampaignsData, getConversionsData, getVisitorSession } from "../storage/analytics";

const sessionSchema = z.object({
  visitorId:   z.string().uuid("visitorId must be a valid UUID"),
  utmSource:   z.string().max(500).nullable().optional().default(null),
  utmMedium:   z.string().max(500).nullable().optional().default(null),
  utmCampaign: z.string().max(500).nullable().optional().default(null),
  utmTerm:     z.string().max(500).nullable().optional().default(null),
  utmContent:  z.string().max(500).nullable().optional().default(null),
  utmId:       z.string().max(500).nullable().optional().default(null),
  referrer:    z.string().max(2000).nullable().optional().default(null),
  landingPage: z.string().max(2000).nullable().optional().default(null),
});

const router = Router();

// POST /api/analytics/session — PUBLIC (no auth required, rate-limited per D-06)
// Called by useUTMCapture hook on first visit and on return visits with UTM signal.
router.post("/session", async (req, res) => {
  try {
    const parsed = sessionSchema.parse(req.body);

    const { session, isNew } = await storage.upsertVisitorSession({
      visitorId:   parsed.visitorId,
      utmSource:   parsed.utmSource ?? null,
      utmMedium:   parsed.utmMedium ?? null,
      utmCampaign: parsed.utmCampaign ?? null,
      utmTerm:     parsed.utmTerm ?? null,
      utmContent:  parsed.utmContent ?? null,
      utmId:       parsed.utmId ?? null,
      referrer:    parsed.referrer ?? null,
      landingPage: parsed.landingPage ?? null,
    });

    return res.status(200).json({ sessionId: session.id, isNew });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    log(`Analytics session error: ${(err as Error).message}`, "analytics");
    // Return 200 even on unexpected errors — analytics is fire-and-forget; never surface errors to client
    return res.status(200).json({ sessionId: null, isNew: false });
  }
});

// POST /api/analytics/events — PUBLIC (no auth, rate-limited)
// Called client-side for booking_started and chat_initiated events (D-08).
// Returns 200 even on error — analytics must never surface failures to the client.
const eventSchema = z.object({
  visitorId: z.string().uuid().optional().nullable(),
  eventType: z.enum(['booking_started', 'chat_initiated']),
  pageUrl:   z.string().max(2000).optional().nullable(),
});

router.post("/events", async (req, res) => {
  try {
    const parsed = eventSchema.parse(req.body);
    await storage.recordConversionEvent(parsed.eventType, {
      visitorId: parsed.visitorId ?? undefined,
      pageUrl:   parsed.pageUrl   ?? undefined,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    log(`Analytics events error: ${(err as Error).message}`, "analytics");
    // Return 200 — analytics is fire-and-forget; never surface errors to client
    return res.status(200).json({ ok: false });
  }
});

// GET /api/analytics/overview?from=&to=
router.get("/overview", requireAdmin, async (req, res) => {
  try {
    const fromStr = req.query.from as string | undefined;
    const toStr   = req.query.to   as string | undefined;
    const fromDate = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate   = toStr   ? new Date(toStr)   : new Date();
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    const data = await getOverviewData(fromDate, toDate);
    return res.json(data);
  } catch (err) {
    log(`Analytics overview error: ${(err as Error).message}`, "analytics");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/analytics/sources?from=&to=
router.get("/sources", requireAdmin, async (req, res) => {
  try {
    const fromStr = req.query.from as string | undefined;
    const toStr   = req.query.to   as string | undefined;
    const fromDate = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate   = toStr   ? new Date(toStr)   : new Date();
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    const data = await getSourcesData(fromDate, toDate);
    return res.json(data);
  } catch (err) {
    log(`Analytics sources error: ${(err as Error).message}`, "analytics");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/analytics/campaigns?from=&to=
router.get("/campaigns", requireAdmin, async (req, res) => {
  try {
    const fromStr = req.query.from as string | undefined;
    const toStr   = req.query.to   as string | undefined;
    const fromDate = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate   = toStr   ? new Date(toStr)   : new Date();
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    const data = await getCampaignsData(fromDate, toDate);
    return res.json(data);
  } catch (err) {
    log(`Analytics campaigns error: ${(err as Error).message}`, "analytics");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/analytics/conversions?from=&to=&source=&limit=&offset=
// D-09: Returns last_touch ConversionEventRow[]. Protected by requireAdmin.
router.get("/conversions", requireAdmin, async (req, res) => {
  try {
    const fromStr   = req.query.from    as string | undefined;
    const toStr     = req.query.to      as string | undefined;
    const source    = req.query.source  as string | undefined;
    const limitStr  = req.query.limit   as string | undefined;
    const offsetStr = req.query.offset  as string | undefined;

    const fromDate = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate   = toStr   ? new Date(toStr)   : new Date();
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    const limit  = Math.min(parseInt(limitStr  ?? '50', 10) || 50,  200); // cap at 200
    const offset = Math.max(parseInt(offsetStr ?? '0',  10) || 0,   0);

    const data = await getConversionsData(fromDate, toDate, source || null, limit, offset);
    return res.json(data);
  } catch (err) {
    log(`Analytics conversions error: ${(err as Error).message}`, "analytics");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/analytics/session/:visitorId
// D-10: Returns full visitor_sessions row for the journey panel. 404 if not found.
router.get("/session/:visitorId", requireAdmin, async (req, res) => {
  try {
    const { visitorId } = req.params;
    if (!visitorId) return res.status(400).json({ message: "visitorId required" });

    const session = await getVisitorSession(visitorId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    return res.json(session);
  } catch (err) {
    log(`Analytics session lookup error: ${(err as Error).message}`, "analytics");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
