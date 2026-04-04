import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { getAvailabilityForDate, getAvailabilityRange } from "../lib/availability";
import { getStaffAvailableSlots, getSlotsForServices, getStaffUnionSlots } from "../lib/staff-availability";
import { getGHLFreeSlots } from "../integrations/ghl";

const router = Router();

const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalDurationMinutes: z.coerce.number().int().positive(),
  staffId: z.coerce.number().int().positive().optional(),
  serviceIds: z.string().optional(), // comma-separated: "1,2,3"
});

const monthAvailabilityQuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  totalDurationMinutes: z.coerce.number().int().positive(),
  staffId: z.coerce.number().int().positive().optional(),
  serviceIds: z.string().optional(), // comma-separated: "1,2,3"
});

router.get("/api/availability", async (req, res) => {
  try {
    const { date, totalDurationMinutes, staffId, serviceIds } = availabilityQuerySchema.parse(req.query);
    const parsedServiceIds = serviceIds ? serviceIds.split(",").map(Number).filter(Boolean) : [];

    const companySettings = await storage.getCompanySettings();
    const timeZone = companySettings?.timeZone || "America/New_York";

    let slots: string[];

    const staffCount = await storage.getStaffCount();

    if (staffCount === 0) {
      // No staff in system — legacy global logic
      const ghlSettings = await storage.getIntegrationSettings("gohighlevel");
      const useGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId);
      slots = await getAvailabilityForDate(date, totalDurationMinutes, useGhl, ghlSettings, {
        timeZone,
        requireGhl: false,
      });
    } else if (parsedServiceIds.length > 0 || staffId) {
      slots = await getSlotsForServices(date, totalDurationMinutes, parsedServiceIds, staffId, { timeZone });
    } else {
      slots = await getStaffUnionSlots(date, totalDurationMinutes, { timeZone });
    }

    const response = slots.map((time) => ({ time, available: true }));
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
    const { year, month, totalDurationMinutes, staffId, serviceIds } = monthAvailabilityQuerySchema.parse(req.query);
    const parsedServiceIds = serviceIds ? serviceIds.split(",").map(Number).filter(Boolean) : [];

    const monthStr = String(month).padStart(2, "0");
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

    const companySettings = await storage.getCompanySettings();
    const timeZone = companySettings?.timeZone || "America/New_York";

    const monthMap: Record<string, boolean> = {};
    for (let day = 1; day <= lastDay; day++) {
      const dateKey = `${year}-${monthStr}-${String(day).padStart(2, "0")}`;
      monthMap[dateKey] = false;
    }

    const staffCount = await storage.getStaffCount();

    // Per-staff month availability
    if (staffCount > 0) {
      for (const dateKey of Object.keys(monthMap)) {
        const slots = await getSlotsForServices(
          dateKey,
          totalDurationMinutes,
          parsedServiceIds,
          staffId,
          { timeZone }
        );
        monthMap[dateKey] = slots.length > 0;
      }
      return res.json(monthMap);
    }

    const ghlSettings = await storage.getIntegrationSettings("gohighlevel");
    const useGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId);

    let ghlSuccess = false;

    // Fast-path for GHL: one API call for the whole month instead of one call per day.
    if (useGhl && ghlSettings?.apiKey && ghlSettings.calendarId) {
      try {
        const startDateObj = new Date(`${startDate}T00:00:00`);
        const endDateObj = new Date(`${endDate}T23:59:59`);
        const ghlSlotsResult = await getGHLFreeSlots(
          ghlSettings.apiKey,
          ghlSettings.calendarId,
          startDateObj,
          endDateObj,
          timeZone
        );

        if (ghlSlotsResult.success && ghlSlotsResult.slots) {
          const availableDates = new Set<string>();
          for (const slot of ghlSlotsResult.slots) {
            const start = slot?.startTime;
            if (typeof start !== "string") continue;
            if (start.length >= 10) {
              const datePart = start.slice(0, 10);
              if (datePart.startsWith(`${year}-${monthStr}-`)) {
                availableDates.add(datePart);
              }
            }
          }

          for (const dateKey of Object.keys(monthMap)) {
            monthMap[dateKey] = availableDates.has(dateKey);
          }
          ghlSuccess = true;
        } else {
          console.error('[GHL] Failed to fetch monthly availability:', ghlSlotsResult.message);
        }
      } catch (error) {
        console.error('[GHL] Error fetching monthly availability:', (error as Error).message);
      }
    }

    // Fall back to local availability if GHL is not enabled or failed
    if (!ghlSuccess) {
      const slotMap = await getAvailabilityRange(startDate, endDate, totalDurationMinutes, {
        useGhl: false,
        ghlSettings: null,
        requireGhl: false,
        timeZone,
      });

      for (const [date, slots] of Object.entries(slotMap)) {
        monthMap[date] = Array.isArray(slots) && slots.length > 0;
      }
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
