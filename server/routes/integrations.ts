
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";
import { 
    getOpenAIClient, 
    setRuntimeOpenAiKey, 
    DEFAULT_CHAT_MODEL, 
    getRuntimeOpenAiKey 
} from "../lib/openai"; 
import {
    getGeminiClient,
    setRuntimeGeminiKey,
    DEFAULT_GEMINI_CHAT_MODEL,
    getRuntimeGeminiKey
} from "../lib/gemini";
import {
    testGHLConnection,
    getGHLFreeSlots,
    getOrCreateGHLContact,
    createGHLAppointment,
    formatDateTimeWithTimezone
} from "../integrations/ghl";
import { insertChatIntegrationsSchema, insertIntegrationSettingsSchema } from "@shared/schema";

const router = Router();

// ===============================
// OpenAI Integration Routes
// ===============================

router.get("/openai", requireAdmin, async (_req, res) => {
    try {
        const integration = await storage.getChatIntegration("openai");
        res.json({
            provider: "openai",
            enabled: integration?.enabled || false,
            model: integration?.model || DEFAULT_CHAT_MODEL,
            hasKey: !!(getRuntimeOpenAiKey() || process.env.OPENAI_API_KEY || integration?.apiKey),
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put("/openai", requireAdmin, async (req, res) => {
    try {
        const existing = await storage.getChatIntegration("openai");
        const payload = insertChatIntegrationsSchema
            .partial()
            .extend({
                apiKey: z.string().min(10).optional(),
            })
            .parse({ ...req.body, provider: "openai" });

        // Handle apiKey:
        // 1. If provided and not masked, use it
        // 2. If masked (********), keep existing or fallback
        // 3. If empty/undefined, keep existing or fallback
        let keyToPersist = existing?.apiKey;

        if (payload.apiKey && payload.apiKey !== "********") {
            keyToPersist = payload.apiKey;
        }

        // Fallback to env var if nothing else
        if (!keyToPersist) {
            keyToPersist = getRuntimeOpenAiKey() || process.env.OPENAI_API_KEY;
        }

        if (keyToPersist) {
            setRuntimeOpenAiKey(keyToPersist);
        }

        const willEnable = payload.enabled ?? false;
        const keyAvailable = !!keyToPersist;

        if (willEnable && !keyAvailable) {
            return res.status(400).json({ message: "Provide a valid API key and test it before enabling." });
        }

        const updated = await storage.upsertChatIntegration({
            provider: "openai",
            enabled: payload.enabled ?? existing?.enabled ?? false,
            model: payload.model || existing?.model || DEFAULT_CHAT_MODEL,
            apiKey: keyToPersist,
        });

        res.json({
            ...updated,
            hasKey: !!keyToPersist,
            apiKey: undefined,
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: err.errors });
        }
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post("/openai/test", requireAdmin, async (req, res) => { 
    try { 
        const bodySchema = z.object({
            apiKey: z.string().min(10).optional(),
            model: z.string().optional(),
        });
        const { apiKey, model } = bodySchema.parse(req.body);
        const existing = await storage.getChatIntegration("openai");
        const keyToUse =
            (apiKey && apiKey !== "********" ? apiKey : undefined) ||
            getRuntimeOpenAiKey() ||
            process.env.OPENAI_API_KEY ||
            existing?.apiKey;

        if (!keyToUse) {
            return res.status(400).json({ success: false, message: "API key is required" });
        }

        const client = getOpenAIClient(keyToUse);
        if (!client) {
            return res.status(400).json({ success: false, message: "Invalid API key" });
        }

        try {
            await client.chat.completions.create({
                model: model || DEFAULT_CHAT_MODEL,
                messages: [{ role: "user", content: "Say pong" }],
                max_completion_tokens: 5,
            });
        } catch (err: any) {
            const message = err?.message || "Failed to test OpenAI connection";
            const status = err?.status || err?.response?.status;
            console.error("OpenAI test error", {
                status,
                message,
                model: model || DEFAULT_CHAT_MODEL,
                hasKey: Boolean(keyToUse),
                requestId: err?.response?.headers?.get?.("x-request-id"),
                errorType: err?.type || err?.code,
            });
            return res.status(500).json({
                success: false,
                message: status ? `OpenAI error (${status}): ${message}` : message,
            });
        }

        // Cache key in memory for runtime use
        setRuntimeOpenAiKey(keyToUse);
        await storage.upsertChatIntegration({
            provider: "openai",
            enabled: existing?.enabled ?? false,
            model: model || existing?.model || DEFAULT_CHAT_MODEL,
            apiKey: keyToUse,
        });

        res.json({ success: true, message: "Connection successful" });
    } catch (err: any) {
        console.error("OpenAI test route error", {
            message: err?.message,
            errorType: err?.type || err?.code,
        });
        res.status(500).json({ success: false, message: err?.message || "Failed to test OpenAI connection" });
    }
}); 
 
// =============================== 
// Gemini Integration Routes 
// =============================== 
 
router.get("/gemini", requireAdmin, async (_req, res) => { 
    try { 
        const integration = await storage.getChatIntegration("gemini"); 
        res.json({ 
            provider: "gemini", 
            enabled: integration?.enabled || false, 
            model: integration?.model || DEFAULT_GEMINI_CHAT_MODEL, 
            hasKey: !!(getRuntimeGeminiKey() || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || integration?.apiKey), 
        }); 
    } catch (err) { 
        res.status(500).json({ message: (err as Error).message }); 
    } 
}); 
 
router.put("/gemini", requireAdmin, async (req, res) => { 
    try { 
        const existing = await storage.getChatIntegration("gemini"); 
        const payload = insertChatIntegrationsSchema 
            .partial() 
            .extend({ 
                apiKey: z.string().min(10).optional(), 
            }) 
            .parse({ ...req.body, provider: "gemini" }); 
 
        let keyToPersist = existing?.apiKey; 
        if (payload.apiKey && payload.apiKey !== "********") { 
            keyToPersist = payload.apiKey; 
        } 
 
        if (!keyToPersist) { 
            keyToPersist = getRuntimeGeminiKey() || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY; 
        } 
 
        if (keyToPersist) { 
            setRuntimeGeminiKey(keyToPersist); 
        } 
 
        const willEnable = payload.enabled ?? false; 
        const keyAvailable = !!keyToPersist; 
        if (willEnable && !keyAvailable) { 
            return res.status(400).json({ message: "Provide a valid API key and test it before enabling." }); 
        } 
 
        const updated = await storage.upsertChatIntegration({ 
            provider: "gemini", 
            enabled: payload.enabled ?? existing?.enabled ?? false, 
            model: payload.model || existing?.model || DEFAULT_GEMINI_CHAT_MODEL, 
            apiKey: keyToPersist, 
        }); 
 
        res.json({ 
            ...updated, 
            hasKey: !!keyToPersist, 
            apiKey: undefined, 
        }); 
    } catch (err) { 
        if (err instanceof z.ZodError) { 
            return res.status(400).json({ message: "Validation error", errors: err.errors }); 
        } 
        res.status(500).json({ message: (err as Error).message }); 
    } 
}); 
 
router.post("/gemini/test", requireAdmin, async (req, res) => { 
    try { 
        const bodySchema = z.object({ 
            apiKey: z.string().min(10).optional(), 
            model: z.string().optional(), 
        }); 
        const { apiKey, model } = bodySchema.parse(req.body); 
        const existing = await storage.getChatIntegration("gemini"); 
        const keyToUse = 
            (apiKey && apiKey !== "********" ? apiKey : undefined) || 
            getRuntimeGeminiKey() || 
            process.env.GEMINI_API_KEY || 
            process.env.GOOGLE_API_KEY || 
            existing?.apiKey; 
 
        if (!keyToUse) { 
            return res.status(400).json({ success: false, message: "API key is required" }); 
        } 
 
        const client = getGeminiClient(keyToUse); 
        if (!client) { 
            return res.status(400).json({ success: false, message: "Invalid API key" }); 
        } 
 
        try { 
            await (client as any).chat.completions.create({ 
                model: model || DEFAULT_GEMINI_CHAT_MODEL, 
                messages: [{ role: "user", content: "Say pong" }], 
                max_tokens: 5, 
            }); 
        } catch (err: any) { 
            const message = err?.message || "Failed to test Gemini connection"; 
            const status = err?.status || err?.response?.status; 
            console.error("Gemini test error", { 
                status, 
                message, 
                model: model || DEFAULT_GEMINI_CHAT_MODEL, 
                hasKey: Boolean(keyToUse), 
                requestId: err?.response?.headers?.get?.("x-request-id"), 
                errorType: err?.type || err?.code, 
            }); 
            return res.status(500).json({ 
                success: false, 
                message: status ? `Gemini error (${status}): ${message}` : message, 
            }); 
        } 
 
        setRuntimeGeminiKey(keyToUse); 
        await storage.upsertChatIntegration({ 
            provider: "gemini", 
            enabled: existing?.enabled ?? false, 
            model: model || existing?.model || DEFAULT_GEMINI_CHAT_MODEL, 
            apiKey: keyToUse, 
        }); 
 
        res.json({ success: true, message: "Connection successful" }); 
    } catch (err: any) { 
        console.error("Gemini test route error", { 
            message: err?.message, 
            errorType: err?.type || err?.code, 
        }); 
        res.status(500).json({ success: false, message: err?.message || "Failed to test Gemini connection" }); 
    } 
}); 
 
// =============================== 
// GoHighLevel Integration Routes 
// =============================== 

// Get GHL settings
router.get("/ghl", requireAdmin, async (req, res) => {
    try {
        const settings = await storage.getIntegrationSettings("gohighlevel");
        if (!settings) {
            return res.json({
                provider: "gohighlevel",
                apiKey: "",
                locationId: "",
                calendarId: "",
                isEnabled: false
            });
        }
        res.json({
            ...settings,
            apiKey: settings.apiKey ? "********" : ""
        });
    } catch (err) {
        console.error("GHL Fetch Error:", err);
        res.status(500).json({ message: (err as Error).message });
    }
});

// Save GHL settings
router.put("/ghl", requireAdmin, async (req, res) => {
    try {
        const { apiKey, locationId, calendarId, isEnabled } = req.body;

        console.log("GHL Save Request:", { apiKey: apiKey ? "provided" : "not provided", locationId, calendarId, isEnabled });

        const existingSettings = await storage.getIntegrationSettings("gohighlevel");

        const settingsToSave: any = {
            provider: "gohighlevel",
            locationId,
            calendarId: calendarId || "",
            isEnabled: isEnabled ?? false
        };

        if (apiKey && apiKey !== "********") {
            settingsToSave.apiKey = apiKey;
        } else if (existingSettings?.apiKey) {
            settingsToSave.apiKey = existingSettings.apiKey;
        }

        const settings = await storage.upsertIntegrationSettings(settingsToSave);

        res.json({
            ...settings,
            apiKey: settings.apiKey ? "********" : ""
        });
    } catch (err) {
        console.error("GHL Save Error:", err);
        res.status(400).json({ message: (err as Error).message });
    }
});

// Test GHL connection
router.post("/ghl/test", requireAdmin, async (req, res) => {
    try {
        const { apiKey, locationId } = req.body;

        let keyToTest = apiKey;
        if (apiKey === "********" || !apiKey) {
            const existingSettings = await storage.getIntegrationSettings("gohighlevel");
            keyToTest = existingSettings?.apiKey;
        }

        if (!keyToTest || !locationId) {
            return res.status(400).json({
                success: false,
                message: "API key and Location ID are required"
            });
        }

        const result = await testGHLConnection(keyToTest, locationId);
        res.json(result);
    } catch (err) {
        res.status(500).json({
            success: false,
            message: (err as Error).message
        });
    }
});

// Get GHL free slots (public - needed for booking flow)
router.get("/ghl/free-slots", async (req, res) => {
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

        const result = await getGHLFreeSlots(
            settings.apiKey,
            settings.calendarId,
            startDate,
            endDate,
            timezone
        );

        res.json({
            enabled: true,
            ...result
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Check if GHL is enabled (public - for frontend to know whether to use GHL)
router.get("/ghl/status", async (req, res) => {
    try {
        const settings = await storage.getIntegrationSettings("gohighlevel");
        res.json({
            enabled: settings?.isEnabled || false,
            hasCalendar: !!settings?.calendarId
        });
    } catch (err) {
        res.json({ enabled: false, hasCalendar: false });
    }
});

// Sync booking to GHL (called after local booking is created)
router.post("/ghl/sync-booking", async (req, res) => {
    try {
        const settings = await storage.getIntegrationSettings("gohighlevel");

        if (!settings?.isEnabled || !settings.apiKey || !settings.locationId || !settings.calendarId) {
            return res.json({ synced: false, reason: "GHL not enabled" });
        }

        const { bookingId, customerName, customerEmail, customerPhone, customerAddress, bookingDate, startTime, endTime, serviceSummary } = req.body;

        const nameParts = customerName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const contactResult = await getOrCreateGHLContact(
            settings.apiKey,
            settings.locationId,
            {
                email: customerEmail,
                firstName,
                lastName,
                phone: customerPhone,
                address: customerAddress
            }
        );

        if (!contactResult.success || !contactResult.contactId) {
            await storage.updateBookingGHLSync(bookingId, "", "", "failed");
            return res.json({
                synced: false,
                reason: contactResult.message || "Failed to create contact"
            });
        }

        const companySettings = await storage.getCompanySettings();
        const timeZone = companySettings?.timeZone || "America/New_York";
        // GHL expects format like "2026-01-27T12:00:00-05:00" not UTC
        const startTimeISO = formatDateTimeWithTimezone(bookingDate, startTime, timeZone);
        const endTimeISO = formatDateTimeWithTimezone(bookingDate, endTime, timeZone);

        const appointmentResult = await createGHLAppointment(
            settings.apiKey,
            settings.calendarId,
            settings.locationId,
            {
                contactId: contactResult.contactId,
                startTime: startTimeISO,
                endTime: endTimeISO,
                title: `Cleaning: ${serviceSummary}`,
                address: customerAddress
            }
        );

        if (!appointmentResult.success || !appointmentResult.appointmentId) {
            await storage.updateBookingGHLSync(bookingId, contactResult.contactId, "", "failed");
            return res.json({
                synced: false,
                reason: appointmentResult.message || "Failed to create appointment"
            });
        }

        await storage.updateBookingGHLSync(
            bookingId,
            contactResult.contactId,
            appointmentResult.appointmentId,
            "synced"
        );

        res.json({
            synced: true,
            contactId: contactResult.contactId,
            appointmentId: appointmentResult.appointmentId
        });
    } catch (err) {
        res.status(500).json({
            synced: false,
            reason: (err as Error).message
        });
    }
});

// ===============================
// Twilio Integration Routes
// ===============================

// Get Twilio settings
router.get("/twilio", requireAdmin, async (_req, res) => {
    try {
        const settings = await storage.getTwilioSettings();
        if (!settings) {
            return res.json({
                enabled: false,
                accountSid: "",
                authToken: "",
                fromPhoneNumber: "",
                toPhoneNumbers: [],
                notifyOnNewChat: true
            });
        }
        res.json({
            ...settings,
            authToken: settings.authToken ? "********" : ""
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Save Twilio settings
router.put("/twilio", requireAdmin, async (req, res) => {
    try {
        const { accountSid, authToken, fromPhoneNumber, toPhoneNumbers, notifyOnNewChat, enabled } = req.body;

        const existingSettings = await storage.getTwilioSettings();

        const settingsToSave: any = {
            accountSid,
            fromPhoneNumber,
            toPhoneNumbers: toPhoneNumbers || [],
            notifyOnNewChat: notifyOnNewChat ?? true,
            enabled: enabled ?? false
        };

        // Only update authToken if a new one is provided (not masked)
        if (authToken && authToken !== "********") {
            settingsToSave.authToken = authToken;
        } else if (existingSettings?.authToken) {
            settingsToSave.authToken = existingSettings.authToken;
        }

        const settings = await storage.saveTwilioSettings(settingsToSave);

        res.json({
            ...settings,
            authToken: settings.authToken ? "********" : ""
        });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// Test Twilio connection
router.post("/twilio/test", requireAdmin, async (req, res) => {
    try {
        const { accountSid, authToken, fromPhoneNumber, toPhoneNumbers } = req.body;

        let tokenToTest = authToken;
        if (authToken === "********" || !authToken) {
            const existingSettings = await storage.getTwilioSettings();
            tokenToTest = existingSettings?.authToken;
        }

        if (!accountSid || !tokenToTest || !fromPhoneNumber || !toPhoneNumbers || toPhoneNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "All fields are required to test Twilio connection, including at least one phone number"
            });
        }

        // Send test SMS using Twilio
        const twilio = await import("twilio");
        const client = twilio.default(accountSid, tokenToTest);

        // Send test SMS to all configured phone numbers
        for (const phoneNumber of toPhoneNumbers) {
            await client.messages.create({
                body: `Test message - Your Twilio integration is working!`,
                from: fromPhoneNumber,
                to: phoneNumber
            });
        }

        res.json({
            success: true,
            message: `Test SMS sent successfully to ${toPhoneNumbers.length} number(s)!`
        });
    } catch (err: any) {
        res.status(500).json({
            success: false,
            message: err?.message || "Failed to send test SMS"
        });
    }
});


// Gemini routes were duplicated here. Removed.

export default router;
