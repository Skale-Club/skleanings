import { Router } from "express";
import { requireAdmin } from "../../lib/auth";
import {
    testGHLConnection,
    getGHLFreeSlots,
    getOrCreateGHLContact,
    createGHLAppointment,
    formatDateTimeWithTimezone,
} from "../../integrations/ghl";

const router = Router();

router.get("/ghl", requireAdmin, async (_req, res) => {
    const storage = res.locals.storage!;
    try {
        const settings = await storage.getIntegrationSettings("gohighlevel");
        if (!settings) {
            return res.json({ provider: "gohighlevel", apiKey: "", locationId: "", calendarId: "", isEnabled: false });
        }
        res.json({ ...settings, apiKey: settings.apiKey ? "********" : "" });
    } catch (err) {
        console.error("GHL Fetch Error:", err);
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put("/ghl", requireAdmin, async (req, res) => {
    const storage = res.locals.storage!;
    try {
        const { apiKey, locationId, calendarId, isEnabled } = req.body;
        console.log("GHL Save Request:", { apiKey: apiKey ? "provided" : "not provided", locationId, calendarId, isEnabled });

        const existingSettings = await storage.getIntegrationSettings("gohighlevel");
        const settingsToSave: any = {
            provider: "gohighlevel",
            locationId,
            calendarId: calendarId || "",
            isEnabled: isEnabled ?? false,
        };

        if (apiKey && apiKey !== "********") {
            settingsToSave.apiKey = apiKey;
        } else if (existingSettings?.apiKey) {
            settingsToSave.apiKey = existingSettings.apiKey;
        }

        const settings = await storage.upsertIntegrationSettings(settingsToSave);
        res.json({ ...settings, apiKey: settings.apiKey ? "********" : "" });
    } catch (err) {
        console.error("GHL Save Error:", err);
        res.status(400).json({ message: (err as Error).message });
    }
});

router.post("/ghl/test", requireAdmin, async (req, res) => {
    const storage = res.locals.storage!;
    try {
        const { apiKey, locationId } = req.body;
        let keyToTest = apiKey;
        if (apiKey === "********" || !apiKey) {
            const existingSettings = await storage.getIntegrationSettings("gohighlevel");
            keyToTest = existingSettings?.apiKey;
        }
        if (!keyToTest || !locationId) {
            return res.status(400).json({ success: false, message: "API key and Location ID are required" });
        }
        const result = await testGHLConnection(keyToTest, locationId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
    }
});

router.get("/ghl/free-slots", async (req, res) => {
    const storage = res.locals.storage!;
    try {
        const settings = await storage.getIntegrationSettings("gohighlevel");
        if (!settings?.isEnabled || !settings.apiKey || !settings.calendarId) {
            return res.json({ enabled: false, slots: {} });
        }
        const startDate = new Date(req.query.startDate as string);
        const endDate = new Date(req.query.endDate as string);
        const companySettings = await storage.getCompanySettings();
        const timezone = (req.query.timezone as string) || companySettings?.timeZone || "America/New_York";
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ message: "Invalid date range" });
        }
        const result = await getGHLFreeSlots(settings.apiKey, settings.calendarId, startDate, endDate, timezone);
        res.json({ enabled: true, ...result });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.get("/ghl/status", async (_req, res) => {
    const storage = res.locals.storage!;
    try {
        const settings = await storage.getIntegrationSettings("gohighlevel");
        res.json({ enabled: settings?.isEnabled || false, hasCalendar: !!settings?.calendarId });
    } catch {
        res.json({ enabled: false, hasCalendar: false });
    }
});

router.post("/ghl/sync-booking", async (req, res) => {
    const storage = res.locals.storage!;
    try {
        const settings = await storage.getIntegrationSettings("gohighlevel");
        if (!settings?.isEnabled || !settings.apiKey || !settings.locationId || !settings.calendarId) {
            return res.json({ synced: false, reason: "GHL not enabled" });
        }

        const { bookingId, customerName, customerEmail, customerPhone, customerAddress, bookingDate, startTime, endTime, serviceSummary } = req.body;
        const nameParts = customerName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const contactResult = await getOrCreateGHLContact(settings.apiKey, settings.locationId, {
            email: customerEmail, firstName, lastName, phone: customerPhone, address: customerAddress,
        });

        if (!contactResult.success || !contactResult.contactId) {
            await storage.updateBookingGHLSync(bookingId, "", "", "failed");
            return res.json({ synced: false, reason: contactResult.message || "Failed to create contact" });
        }

        const companySettings = await storage.getCompanySettings();
        const timeZone = companySettings?.timeZone || "America/New_York";
        const startTimeISO = formatDateTimeWithTimezone(bookingDate, startTime, timeZone);
        const endTimeISO = formatDateTimeWithTimezone(bookingDate, endTime, timeZone);

        const appointmentResult = await createGHLAppointment(settings.apiKey, settings.calendarId, settings.locationId, {
            contactId: contactResult.contactId,
            startTime: startTimeISO,
            endTime: endTimeISO,
            title: `Cleaning: ${serviceSummary}`,
            address: customerAddress,
        });

        if (!appointmentResult.success || !appointmentResult.appointmentId) {
            await storage.updateBookingGHLSync(bookingId, contactResult.contactId, "", "failed");
            return res.json({ synced: false, reason: appointmentResult.message || "Failed to create appointment" });
        }

        await storage.updateBookingGHLSync(bookingId, contactResult.contactId, appointmentResult.appointmentId, "synced");
        res.json({ synced: true, contactId: contactResult.contactId, appointmentId: appointmentResult.appointmentId });
    } catch (err) {
        res.status(500).json({ synced: false, reason: (err as Error).message });
    }
});

export default router;
