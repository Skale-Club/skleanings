import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage/index";
import { isRateLimited } from "../lib/rate-limit";
import { log } from "../lib/logger";

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
    const ip = req.ip || "unknown";

    // D-06: Rate limit 60 req/IP/min (much higher than booking endpoints — analytics is high-frequency)
    if (isRateLimited(`analytics:${ip}`, 60, 60_000)) {
      return res.status(429).json({ message: "Too many requests" });
    }

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

export default router;
