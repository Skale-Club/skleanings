
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
    getOpenRouterClient,
    setRuntimeOpenRouterKey,
    DEFAULT_OPENROUTER_CHAT_MODEL,
    getRuntimeOpenRouterKey,
    listOpenRouterModels
} from "../lib/openrouter";
import { getConnectAuthUrl, exchangeConnectCode, deauthorizeConnectAccount } from "../lib/stripe";
import {
    testGHLConnection,
    getGHLFreeSlots,
    getOrCreateGHLContact,
    createGHLAppointment,
    formatDateTimeWithTimezone
} from "../integrations/ghl";
import {
    insertChatIntegrationsSchema,
    insertIntegrationSettingsSchema,
    insertTelegramSettingsSchema,
} from "@shared/schema";
import {
    hasTelegramCredentials,
    isMaskedToken,
    isValidTelegramBotToken,
    maskToken,
    sendTelegramTestMessage,
} from "../integrations/telegram";
import {
    exchangeCodeForTokens,
    buildAuthorizationUrl,
} from "../integrations/thumbtack";
import crypto from "crypto";

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
// OpenRouter Integration Routes
// ===============================

router.get("/openrouter", requireAdmin, async (_req, res) => {
    try {
        const integration = await storage.getChatIntegration("openrouter");
        res.json({
            provider: "openrouter",
            enabled: integration?.enabled || false,
            model: integration?.model || DEFAULT_OPENROUTER_CHAT_MODEL,
            hasKey: !!(getRuntimeOpenRouterKey() || process.env.OPENROUTER_API_KEY || integration?.apiKey),
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put("/openrouter", requireAdmin, async (req, res) => {
    try {
        const existing = await storage.getChatIntegration("openrouter");
        const payload = insertChatIntegrationsSchema
            .partial()
            .extend({
                apiKey: z.string().min(10).optional(),
            })
            .parse({ ...req.body, provider: "openrouter" });

        let keyToPersist = existing?.apiKey;
        if (payload.apiKey && payload.apiKey !== "********") {
            keyToPersist = payload.apiKey;
        }

        if (!keyToPersist) {
            keyToPersist = getRuntimeOpenRouterKey() || process.env.OPENROUTER_API_KEY;
        }

        if (keyToPersist) {
            setRuntimeOpenRouterKey(keyToPersist);
        }

        const willEnable = payload.enabled ?? false;
        const keyAvailable = !!keyToPersist;
        if (willEnable && !keyAvailable) {
            return res.status(400).json({ message: "Provide a valid API key and test it before enabling." });
        }

        const updated = await storage.upsertChatIntegration({
            provider: "openrouter",
            enabled: payload.enabled ?? existing?.enabled ?? false,
            model: payload.model || existing?.model || DEFAULT_OPENROUTER_CHAT_MODEL,
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

router.post("/openrouter/test", requireAdmin, async (req, res) => {
    try {
        const bodySchema = z.object({
            apiKey: z.string().min(10).optional(),
            model: z.string().optional(),
        });
        const { apiKey, model } = bodySchema.parse(req.body);
        const existing = await storage.getChatIntegration("openrouter");
        const keyToUse =
            (apiKey && apiKey !== "********" ? apiKey : undefined) ||
            getRuntimeOpenRouterKey() ||
            process.env.OPENROUTER_API_KEY ||
            existing?.apiKey;

        if (!keyToUse) {
            return res.status(400).json({ success: false, message: "API key is required" });
        }

        const client = getOpenRouterClient(keyToUse);
        if (!client) {
            return res.status(400).json({ success: false, message: "Invalid API key" });
        }

        try {
            await client.chat.completions.create({
                model: model || DEFAULT_OPENROUTER_CHAT_MODEL,
                messages: [{ role: "user", content: "Say pong" }],
                max_tokens: 5,
            });
        } catch (err: any) {
            const message = err?.message || "Failed to test OpenRouter connection";
            const status = err?.status || err?.response?.status;
            console.error("OpenRouter test error", {
                status,
                message,
                model: model || DEFAULT_OPENROUTER_CHAT_MODEL,
                hasKey: Boolean(keyToUse),
                requestId: err?.response?.headers?.get?.("x-request-id"),
                errorType: err?.type || err?.code,
            });
            return res.status(500).json({
                success: false,
                message: status ? `OpenRouter error (${status}): ${message}` : message,
            });
        }

        setRuntimeOpenRouterKey(keyToUse);
        await storage.upsertChatIntegration({
            provider: "openrouter",
            enabled: existing?.enabled ?? false,
            model: model || existing?.model || DEFAULT_OPENROUTER_CHAT_MODEL,
            apiKey: keyToUse,
        });

        res.json({ success: true, message: "Connection successful" });
    } catch (err: any) {
        console.error("OpenRouter test route error", {
            message: err?.message,
            errorType: err?.type || err?.code,
        });
        res.status(500).json({ success: false, message: err?.message || "Failed to test OpenRouter connection" });
    }
});

router.get("/openrouter/models", requireAdmin, async (_req, res) => {
    try {
        const existing = await storage.getChatIntegration("openrouter");
        const keyToUse =
            getRuntimeOpenRouterKey() ||
            process.env.OPENROUTER_API_KEY ||
            existing?.apiKey;

        if (!keyToUse) {
            return res.status(400).json({
                message: "API key is required. Save and test OpenRouter first.",
            });
        }

        const models = await listOpenRouterModels(keyToUse);
        res.json({
            count: models.length,
            models,
        });
    } catch (err: any) {
        res.status(500).json({
            message: err?.message || "Failed to fetch OpenRouter models",
        });
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

// ===============================
// Telegram Integration Routes
// ===============================

// Get Telegram settings
router.get("/telegram", requireAdmin, async (_req, res) => {
    try {
        const settings = await storage.getTelegramSettings();
        if (!settings) {
            return res.json({
                enabled: false,
                botToken: "",
                chatIds: [],
                notifyOnNewChat: true,
            });
        }

        res.json({
            ...settings,
            botToken: maskToken(settings.botToken),
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Save Telegram settings
router.put("/telegram", requireAdmin, async (req, res) => {
    try {
        const payload = insertTelegramSettingsSchema.partial().parse(req.body);
        const existingSettings = await storage.getTelegramSettings();

        const incomingToken = payload.botToken?.trim();
        if (incomingToken && !isMaskedToken(incomingToken) && !isValidTelegramBotToken(incomingToken)) {
            return res.status(400).json({
                message: "Bot token format is invalid. Expected format: <digits>:<token>",
            });
        }

        const normalizedChatIds = payload.chatIds
            ? Array.from(new Set(payload.chatIds.map((chatId) => chatId.trim()).filter(Boolean)))
            : (existingSettings?.chatIds || []);

        const settingsToSave: any = {
            enabled: payload.enabled ?? existingSettings?.enabled ?? false,
            chatIds: normalizedChatIds,
            notifyOnNewChat: payload.notifyOnNewChat ?? existingSettings?.notifyOnNewChat ?? true,
        };

        if (incomingToken && !isMaskedToken(incomingToken)) {
            settingsToSave.botToken = incomingToken;
        } else if (existingSettings?.botToken) {
            settingsToSave.botToken = existingSettings.botToken;
        }

        const settings = await storage.saveTelegramSettings(settingsToSave);
        res.json({
            ...settings,
            botToken: maskToken(settings.botToken),
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

// Test Telegram connection
router.post("/telegram/test", requireAdmin, async (req, res) => {
    try {
        const bodySchema = z.object({
            botToken: z.string().optional(),
            chatIds: z.array(z.string()).optional(),
        });
        const { botToken, chatIds } = bodySchema.parse(req.body || {});
        const existingSettings = await storage.getTelegramSettings();
        const companySettings = await storage.getCompanySettings();

        const incomingToken = botToken?.trim();
        if (incomingToken && !isMaskedToken(incomingToken) && !isValidTelegramBotToken(incomingToken)) {
            return res.status(400).json({
                success: false,
                message: "Bot token format is invalid. Expected format: <digits>:<token>",
            });
        }

        const tokenToTest =
            incomingToken && !isMaskedToken(incomingToken)
                ? incomingToken
                : existingSettings?.botToken;

        const chatIdsToTest = chatIds
            ? Array.from(new Set(chatIds.map((chatId) => chatId.trim()).filter(Boolean)))
            : (existingSettings?.chatIds || []);

        const settingsToTest = {
            enabled: true,
            botToken: tokenToTest || "",
            chatIds: chatIdsToTest,
            notifyOnNewChat: existingSettings?.notifyOnNewChat ?? true,
            id: existingSettings?.id ?? 0,
            createdAt: existingSettings?.createdAt ?? new Date(),
            updatedAt: existingSettings?.updatedAt ?? new Date(),
        };

        if (!hasTelegramCredentials(settingsToTest)) {
            return res.status(400).json({
                success: false,
                message: "Bot token and at least one chat ID are required",
            });
        }

        const companyNameForTest =
            (companySettings?.companyName || "").trim() ||
            (companySettings?.ogSiteName || "").trim() ||
            (process.env.WHITE_LABEL_NAME || "").trim() ||
            (process.env.COMPANY_NAME || "").trim() ||
            "Skleanings";

        const result = await sendTelegramTestMessage(settingsToTest, companyNameForTest);
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.message || "Failed to send Telegram test message",
            });
        }

        res.json({
            success: true,
            message: "Test message sent successfully",
            companyNameUsed: companyNameForTest,
        });
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: err.errors,
            });
        }
        res.status(500).json({
            success: false,
            message: err?.message || "Failed to send Telegram test message",
        });
    }
});


// ===============================
// Thumbtack Integration Routes
// ===============================

// OAuth callback - Thumbtack redirects here after user authorization
router.get("/thumbtack/callback", async (req, res) => {
    try {
        const { code, state, error } = req.query;

        if (error) {
            console.error("Thumbtack OAuth error:", error);
            return res.status(400).json({
                success: false,
                message: `Thumbtack authorization failed: ${error}`,
            });
        }

        if (!code || typeof code !== "string") {
            return res.status(400).json({
                success: false,
                message: "Missing authorization code from Thumbtack",
            });
        }

        const clientId = process.env.THUMBTACK_CLIENT_ID;
        const clientSecret = process.env.THUMBTACK_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(500).json({
                success: false,
                message: "Thumbtack client credentials not configured",
            });
        }

        const baseUrl = process.env.SITE_URL || "https://www.skleanings.com";
        const redirectUri = `${baseUrl}/api/integrations/thumbtack/callback`;

        const tokens = await exchangeCodeForTokens(
            code,
            clientId,
            clientSecret,
            redirectUri,
        );

        // Store tokens securely (log success, tokens should be persisted to DB in future)
        console.log("Thumbtack OAuth success - tokens received", {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            expiresIn: tokens.expires_in,
            state,
        });

        // Return a user-friendly success page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Thumbtack Connected</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 60px;">
                <h1>Thumbtack Connected Successfully!</h1>
                <p>Your Skleanings account is now linked to Thumbtack.</p>
                <p>You can close this window.</p>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("Thumbtack callback error:", err);
        res.status(500).json({
            success: false,
            message: (err as Error).message,
        });
    }
});

// Start OAuth flow - redirects to Thumbtack authorization page
router.get("/thumbtack/authorize", requireAdmin, async (_req, res) => {
    try {
        const clientId = process.env.THUMBTACK_CLIENT_ID;

        if (!clientId) {
            return res.status(500).json({
                success: false,
                message: "Thumbtack client ID not configured",
            });
        }

        const baseUrl = process.env.SITE_URL || "https://www.skleanings.com";
        const redirectUri = `${baseUrl}/api/integrations/thumbtack/callback`;
        const state = crypto.randomBytes(16).toString("hex");

        const authUrl = buildAuthorizationUrl(
            clientId,
            redirectUri,
            ["offline_access"],
            state,
        );

        res.redirect(authUrl);
    } catch (err) {
        res.status(500).json({
            success: false,
            message: (err as Error).message,
        });
    }
});

// ===============================
// Google Calendar Integration Routes
// ===============================

// Get Google Calendar OAuth credentials
router.get("/google-calendar", requireAdmin, async (req, res) => {
    try {
        const settings = await storage.getIntegrationSettings("google-calendar");
        if (!settings) {
            return res.json({
                provider: "google-calendar",
                apiKey: "",
                locationId: "",
                calendarId: "",
                isEnabled: false
            });
        }
        res.json({
            ...settings,
            apiKey: settings.apiKey ? "********" : "",
            locationId: settings.locationId ? "********" : "",
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Save Google Calendar OAuth credentials
router.put("/google-calendar", requireAdmin, async (req, res) => {
    try {
        const { apiKey, locationId, calendarId, isEnabled } = req.body;

        const existingSettings = await storage.getIntegrationSettings("google-calendar");

        const settingsToSave: any = {
            provider: "google-calendar",
            calendarId: calendarId || "",
            isEnabled: isEnabled ?? false
        };

        // apiKey = GOOGLE_CLIENT_ID
        if (apiKey && apiKey !== "********") {
            settingsToSave.apiKey = apiKey;
        } else if (existingSettings?.apiKey) {
            settingsToSave.apiKey = existingSettings.apiKey;
        }

        // locationId = GOOGLE_CLIENT_SECRET
        if (locationId && locationId !== "********") {
            settingsToSave.locationId = locationId;
        } else if (existingSettings?.locationId) {
            settingsToSave.locationId = existingSettings.locationId;
        }

        const settings = await storage.upsertIntegrationSettings(settingsToSave);

        res.json({
            ...settings,
            apiKey: settings.apiKey ? "********" : "",
            locationId: settings.locationId ? "********" : "",
        });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// POST /api/integrations/google-calendar/test — validate saved credentials against Google
router.post("/google-calendar/test", requireAdmin, async (_req, res) => {
    try {
        const settings = await storage.getIntegrationSettings("google-calendar");
        if (!settings?.apiKey || !settings?.locationId) {
            return res.status(400).json({ ok: false, message: "Client ID and Client Secret are not saved yet." });
        }
        if (!settings.calendarId) {
            return res.status(400).json({ ok: false, message: "Redirect URI is not saved yet." });
        }

        // Hit Google's token endpoint with a dummy code.
        // "invalid_client" → wrong Client ID / Secret
        // "redirect_uri_mismatch" → Redirect URI not in Google Console
        // "invalid_grant" → credentials are recognised (dummy code is expected to fail this way)
        const params = new URLSearchParams({
            client_id: settings.apiKey,
            client_secret: settings.locationId,
            code: "test_probe_code",
            grant_type: "authorization_code",
            redirect_uri: settings.calendarId,
        });

        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const data = await response.json() as { error?: string; error_description?: string };
        const err = data.error;

        if (err === "invalid_client") {
            return res.json({ ok: false, message: "Invalid Client ID or Client Secret — Google did not recognise these credentials." });
        }
        if (err === "redirect_uri_mismatch") {
            return res.json({ ok: false, message: "Redirect URI mismatch — add the URI to your OAuth client's Authorized Redirect URIs in Google Cloud Console." });
        }
        if (err === "invalid_grant" || err === "invalid_request") {
            // Expected errors for a dummy code with valid credentials
            return res.json({ ok: true, message: "Credentials are valid. Google recognised your Client ID and Secret." });
        }

        // Unexpected response — surface it
        return res.json({ ok: false, message: data.error_description || `Unexpected response from Google: ${err}` });
    } catch (err) {
        res.status(500).json({ ok: false, message: (err as Error).message });
    }
});

// ===============================
// Stripe Integration Routes
// ===============================

// GET /stripe — connection status (not raw credentials)
router.get("/stripe", requireAdmin, async (req, res) => {
    try {
        const settings = await storage.getIntegrationSettings("stripe");
        if (!settings?.apiKey) return res.json({ connected: false });
        res.json({
            connected: true,
            stripeUserId: settings.locationId || "",
            webhookSecret: settings.calendarId ? "********" : "",
            isEnabled: settings.isEnabled ?? false,
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// PUT /stripe/webhook — save webhook secret + isEnabled toggle
router.put("/stripe/webhook", requireAdmin, async (req, res) => {
    try {
        const { webhookSecret, isEnabled } = req.body;
        const existing = await storage.getIntegrationSettings("stripe");
        const toSave: any = {
            provider: "stripe",
            apiKey: existing?.apiKey ?? "",
            locationId: existing?.locationId ?? "",
            isEnabled: isEnabled ?? existing?.isEnabled ?? false,
        };
        if (webhookSecret && webhookSecret !== "********") {
            toSave.calendarId = webhookSecret;
        } else {
            toSave.calendarId = existing?.calendarId ?? "";
        }
        await storage.upsertIntegrationSettings(toSave);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// GET /stripe/connect — initiate Stripe Connect OAuth
router.get("/stripe/connect", requireAdmin, async (req, res) => {
    try {
        if (!process.env.STRIPE_CLIENT_ID) {
            return res.status(501).json({ message: "STRIPE_CLIENT_ID env var not configured on server." });
        }
        const url = getConnectAuthUrl();
        res.redirect(url);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// GET /stripe/callback — exchange OAuth code, store tokens
router.get("/stripe/callback", async (req, res) => {
    try {
        const code = String(req.query.code || "");
        if (!code) return res.status(400).send("Missing OAuth code");
        const { accessToken, stripeUserId } = await exchangeConnectCode(code);
        const existing = await storage.getIntegrationSettings("stripe");
        await storage.upsertIntegrationSettings({
            provider: "stripe",
            apiKey: accessToken,
            locationId: stripeUserId,
            calendarId: existing?.calendarId ?? "",
            isEnabled: existing?.isEnabled ?? true,
        });
        res.redirect("/admin/integrations");
    } catch (err) {
        res.status(500).send(`Stripe Connect error: ${(err as Error).message}`);
    }
});

// DELETE /stripe/disconnect — revoke and clear tokens
router.delete("/stripe/disconnect", requireAdmin, async (req, res) => {
    try {
        const existing = await storage.getIntegrationSettings("stripe");
        if (existing?.locationId) {
            await deauthorizeConnectAccount(existing.locationId);
        }
        await storage.upsertIntegrationSettings({
            provider: "stripe",
            apiKey: "",
            locationId: "",
            calendarId: existing?.calendarId ?? "",
            isEnabled: false,
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

export default router;
