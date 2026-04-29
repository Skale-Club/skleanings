import { Router } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAdmin } from "../../lib/auth";
import { getOpenAIClient, setRuntimeOpenAiKey, DEFAULT_CHAT_MODEL, getRuntimeOpenAiKey } from "../../lib/openai";
import { getGeminiClient, setRuntimeGeminiKey, DEFAULT_GEMINI_CHAT_MODEL, getRuntimeGeminiKey } from "../../lib/gemini";
import { getOpenRouterClient, setRuntimeOpenRouterKey, DEFAULT_OPENROUTER_CHAT_MODEL, getRuntimeOpenRouterKey, listOpenRouterModels } from "../../lib/openrouter";
import { insertChatIntegrationsSchema } from "@shared/schema";

const router = Router();

// ─── OpenAI ───────────────────────────────────────────────────────────────────

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
        const payload = insertChatIntegrationsSchema.partial().extend({ apiKey: z.string().min(10).optional() })
            .parse({ ...req.body, provider: "openai" });

        let keyToPersist = existing?.apiKey;
        if (payload.apiKey && payload.apiKey !== "********") keyToPersist = payload.apiKey;
        if (!keyToPersist) keyToPersist = getRuntimeOpenAiKey() || process.env.OPENAI_API_KEY;
        if (keyToPersist) setRuntimeOpenAiKey(keyToPersist);

        if ((payload.enabled ?? false) && !keyToPersist) {
            return res.status(400).json({ message: "Provide a valid API key and test it before enabling." });
        }

        const updated = await storage.upsertChatIntegration({
            provider: "openai",
            enabled: payload.enabled ?? existing?.enabled ?? false,
            model: payload.model || existing?.model || DEFAULT_CHAT_MODEL,
            apiKey: keyToPersist,
        });
        res.json({ ...updated, hasKey: !!keyToPersist, apiKey: undefined });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post("/openai/test", requireAdmin, async (req, res) => {
    try {
        const { apiKey, model } = z.object({ apiKey: z.string().min(10).optional(), model: z.string().optional() }).parse(req.body);
        const existing = await storage.getChatIntegration("openai");
        const keyToUse = (apiKey && apiKey !== "********" ? apiKey : undefined) || getRuntimeOpenAiKey() || process.env.OPENAI_API_KEY || existing?.apiKey;
        if (!keyToUse) return res.status(400).json({ success: false, message: "API key is required" });

        const client = getOpenAIClient(keyToUse);
        if (!client) return res.status(400).json({ success: false, message: "Invalid API key" });

        try {
            await client.chat.completions.create({ model: model || DEFAULT_CHAT_MODEL, messages: [{ role: "user", content: "Say pong" }], max_completion_tokens: 5 });
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const message = err?.message || "Failed to test OpenAI connection";
            return res.status(500).json({ success: false, message: status ? `OpenAI error (${status}): ${message}` : message });
        }

        setRuntimeOpenAiKey(keyToUse);
        await storage.upsertChatIntegration({ provider: "openai", enabled: existing?.enabled ?? false, model: model || existing?.model || DEFAULT_CHAT_MODEL, apiKey: keyToUse });
        res.json({ success: true, message: "Connection successful" });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err?.message || "Failed to test OpenAI connection" });
    }
});

// ─── Gemini ───────────────────────────────────────────────────────────────────

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
        const payload = insertChatIntegrationsSchema.partial().extend({ apiKey: z.string().min(10).optional() })
            .parse({ ...req.body, provider: "gemini" });

        let keyToPersist = existing?.apiKey;
        if (payload.apiKey && payload.apiKey !== "********") keyToPersist = payload.apiKey;
        if (!keyToPersist) keyToPersist = getRuntimeGeminiKey() || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (keyToPersist) setRuntimeGeminiKey(keyToPersist);

        if ((payload.enabled ?? false) && !keyToPersist) {
            return res.status(400).json({ message: "Provide a valid API key and test it before enabling." });
        }

        const updated = await storage.upsertChatIntegration({
            provider: "gemini",
            enabled: payload.enabled ?? existing?.enabled ?? false,
            model: payload.model || existing?.model || DEFAULT_GEMINI_CHAT_MODEL,
            apiKey: keyToPersist,
        });
        res.json({ ...updated, hasKey: !!keyToPersist, apiKey: undefined });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post("/gemini/test", requireAdmin, async (req, res) => {
    try {
        const { apiKey, model } = z.object({ apiKey: z.string().min(10).optional(), model: z.string().optional() }).parse(req.body);
        const existing = await storage.getChatIntegration("gemini");
        const keyToUse = (apiKey && apiKey !== "********" ? apiKey : undefined) || getRuntimeGeminiKey() || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || existing?.apiKey;
        if (!keyToUse) return res.status(400).json({ success: false, message: "API key is required" });

        const client = getGeminiClient(keyToUse);
        if (!client) return res.status(400).json({ success: false, message: "Invalid API key" });

        try {
            await (client as any).chat.completions.create({ model: model || DEFAULT_GEMINI_CHAT_MODEL, messages: [{ role: "user", content: "Say pong" }], max_tokens: 5 });
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const message = err?.message || "Failed to test Gemini connection";
            return res.status(500).json({ success: false, message: status ? `Gemini error (${status}): ${message}` : message });
        }

        setRuntimeGeminiKey(keyToUse);
        await storage.upsertChatIntegration({ provider: "gemini", enabled: existing?.enabled ?? false, model: model || existing?.model || DEFAULT_GEMINI_CHAT_MODEL, apiKey: keyToUse });
        res.json({ success: true, message: "Connection successful" });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err?.message || "Failed to test Gemini connection" });
    }
});

// ─── OpenRouter ───────────────────────────────────────────────────────────────

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
        const payload = insertChatIntegrationsSchema.partial().extend({ apiKey: z.string().min(10).optional() })
            .parse({ ...req.body, provider: "openrouter" });

        let keyToPersist = existing?.apiKey;
        if (payload.apiKey && payload.apiKey !== "********") keyToPersist = payload.apiKey;
        if (!keyToPersist) keyToPersist = getRuntimeOpenRouterKey() || process.env.OPENROUTER_API_KEY;
        if (keyToPersist) setRuntimeOpenRouterKey(keyToPersist);

        if ((payload.enabled ?? false) && !keyToPersist) {
            return res.status(400).json({ message: "Provide a valid API key and test it before enabling." });
        }

        const updated = await storage.upsertChatIntegration({
            provider: "openrouter",
            enabled: payload.enabled ?? existing?.enabled ?? false,
            model: payload.model || existing?.model || DEFAULT_OPENROUTER_CHAT_MODEL,
            apiKey: keyToPersist,
        });
        res.json({ ...updated, hasKey: !!keyToPersist, apiKey: undefined });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post("/openrouter/test", requireAdmin, async (req, res) => {
    try {
        const { apiKey, model } = z.object({ apiKey: z.string().min(10).optional(), model: z.string().optional() }).parse(req.body);
        const existing = await storage.getChatIntegration("openrouter");
        const keyToUse = (apiKey && apiKey !== "********" ? apiKey : undefined) || getRuntimeOpenRouterKey() || process.env.OPENROUTER_API_KEY || existing?.apiKey;
        if (!keyToUse) return res.status(400).json({ success: false, message: "API key is required" });

        const cs = await storage.getCompanySettings();
        const client = getOpenRouterClient(keyToUse, cs?.companyName ?? undefined);
        if (!client) return res.status(400).json({ success: false, message: "Invalid API key" });

        try {
            await client.chat.completions.create({ model: model || DEFAULT_OPENROUTER_CHAT_MODEL, messages: [{ role: "user", content: "Say pong" }], max_tokens: 5 });
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const message = err?.message || "Failed to test OpenRouter connection";
            return res.status(500).json({ success: false, message: status ? `OpenRouter error (${status}): ${message}` : message });
        }

        setRuntimeOpenRouterKey(keyToUse);
        await storage.upsertChatIntegration({ provider: "openrouter", enabled: existing?.enabled ?? false, model: model || existing?.model || DEFAULT_OPENROUTER_CHAT_MODEL, apiKey: keyToUse });
        res.json({ success: true, message: "Connection successful" });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err?.message || "Failed to test OpenRouter connection" });
    }
});

router.get("/openrouter/models", requireAdmin, async (_req, res) => {
    try {
        const existing = await storage.getChatIntegration("openrouter");
        const keyToUse = getRuntimeOpenRouterKey() || process.env.OPENROUTER_API_KEY || existing?.apiKey;
        if (!keyToUse) return res.status(400).json({ message: "API key is required. Save and test OpenRouter first." });
        const cs = await storage.getCompanySettings();
        const models = await listOpenRouterModels(keyToUse, cs?.companyName ?? undefined);
        res.json({ count: models.length, models });
    } catch (err: any) {
        res.status(500).json({ message: err?.message || "Failed to fetch OpenRouter models" });
    }
});

export default router;
