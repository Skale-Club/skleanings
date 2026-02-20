import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { getAvailabilityForDate, getAvailabilityRange } from "../lib/availability";

const router = Router();

const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalDurationMinutes: z.coerce.number().int().positive(),
});

const monthAvailabilityQuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  totalDurationMinutes: z.coerce.number().int().positive(),
});

router.get("/api/availability", async (req, res) => {
  try {
    const { date, totalDurationMinutes } = availabilityQuerySchema.parse(req.query);

    const ghlSettings = await storage.getIntegrationSettings("gohighlevel");
    const useGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId);
    const companySettings = await storage.getCompanySettings();
    const timeZone = companySettings?.timeZone || "America/New_York";

    const availableSlots = await getAvailabilityForDate(
      date,
      totalDurationMinutes,
      useGhl,
      ghlSettings,
      { timeZone, requireGhl: useGhl }
    );

    const response = availableSlots.map((time) => ({ time, available: true }));
    res.json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(500).json({ message: (err as Error).message });
  }
});

router.get("/api/availability/month", async (req, res) => {
  try {
    const { year, month, totalDurationMinutes } = monthAvailabilityQuerySchema.parse(req.query);

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const ghlSettings = await storage.getIntegrationSettings("gohighlevel");
    const useGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId);
    const companySettings = await storage.getCompanySettings();
    const timeZone = companySettings?.timeZone || "America/New_York";

    const slotMap = await getAvailabilityRange(startDate, endDate, totalDurationMinutes, {
      useGhl,
      ghlSettings,
      requireGhl: useGhl,
      timeZone,
    });
    const monthMap: Record<string, boolean> = {};

    for (const [date, slots] of Object.entries(slotMap)) {
      monthMap[date] = Array.isArray(slots) && slots.length > 0;
    }

    res.json(monthMap);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(500).json({ message: (err as Error).message });
  }
});

export default router;
