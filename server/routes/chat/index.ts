
import { Router } from "express";
import { handleMessage } from "./message-handler";
import { requireAdmin } from "../../lib/auth";
import { storage } from "../../storage";
import { insertChatSettingsSchema } from "@shared/schema";
import { conversationEvents } from "../../lib/chat-events";
import { z } from "zod";

const router = Router();

// ============================
// Public Endpoints
// ============================

// POST /api/chat/message — public chat message handler
router.post("/chat/message", handleMessage);

// GET /api/chat/config — public chat widget config (controls whether chat appears)
router.get("/chat/config", async (_req, res) => {
    try {
        const settings = await storage.getChatSettings();
        const companySettings = await storage.getCompanySettings();

        if (!settings) {
            return res.json({
                enabled: false,
                agentName: "Assistant",
                welcomeMessage: "Hi! How can I help?",
                agentAvatarUrl: "",
                fallbackAvatarUrl: undefined,
                companyLogo: companySettings?.logoIcon || undefined,
                languageSelectorEnabled: false,
                defaultLanguage: "en",
                excludedUrlRules: [],
            });
        }

        // @ts-ignore - uiSettings structure mismatch with generated types
        const ui = settings.uiSettings || {};
        res.json({
            enabled: settings.enabled ?? false,
            agentName: settings.agentName || ui.title || "Assistant",
            agentAvatarUrl: settings.agentAvatarUrl || ui.avatarUrl || "",
            fallbackAvatarUrl: undefined,
            companyLogo: companySettings?.logoIcon || undefined,
            welcomeMessage: settings.welcomeMessage || ui.welcomeMessage || "Hi! How can I help?",
            languageSelectorEnabled: settings.languageSelectorEnabled ?? false,
            defaultLanguage: settings.defaultLanguage || "en",
            excludedUrlRules: [],
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// GET /api/chat/conversations/:id/messages — paginated messages (used by public ChatWidget AND admin)
// No requireAdmin here so ChatWidget can load its own conversation history
router.get("/chat/conversations/:id/messages", async (req, res) => {
    try {
        const { id } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const before = req.query.before as string | undefined;
        const includeInternal = req.query.includeInternal === "true";

        // Get all messages for the conversation
        const allMessages = await storage.getConversationMessages(id);

        // Filter out internal messages unless admin requests them
        let filtered = includeInternal
            ? allMessages
            : allMessages.filter((m: any) => !m.metadata?.internal);

        // Cursor-based pagination: if 'before' is specified, only return messages before that ID
        let startIndex = 0;
        if (before) {
            const idx = filtered.findIndex((m: any) => String(m.id) === before);
            if (idx > 0) {
                // Return messages BEFORE this index
                const sliceStart = Math.max(0, idx - limit);
                const sliced = filtered.slice(sliceStart, idx);
                return res.json({
                    messages: sliced,
                    hasMore: sliceStart > 0,
                });
            }
            // If before ID not found, return empty
            return res.json({ messages: [], hasMore: false });
        }

        // Default: return the last 'limit' messages
        const hasMore = filtered.length > limit;
        const messages = hasMore ? filtered.slice(filtered.length - limit) : filtered;

        res.json({ messages, hasMore });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// ============================
// Admin Endpoints
// ============================

// GET /api/chat/settings — full admin chat settings
router.get("/chat/settings", requireAdmin, async (_req, res) => {
    try {
        const settings = await storage.getChatSettings();
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// PUT /api/chat/settings — update admin chat settings (partial update)
router.put("/chat/settings", requireAdmin, async (req, res) => {
    try {
        const validatedData = insertChatSettingsSchema.partial().parse(req.body);
        const settings = await storage.updateChatSettings(validatedData);
        res.json(settings);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

// POST /api/chat/config — legacy admin update settings (kept for backward compat)
router.post("/chat/config", requireAdmin, async (req, res) => {
    try {
        const validatedData = insertChatSettingsSchema.parse(req.body);
        const settings = await storage.updateChatSettings(validatedData);
        res.json(settings);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

// GET /api/chat/ghl-status — check if GHL is configured and ready for chat
router.get("/chat/ghl-status", requireAdmin, async (_req, res) => {
    try {
        const ghlSettings = await storage.getIntegrationSettings("gohighlevel");
        const chatSettings = await storage.getChatSettings();

        res.json({
            chatEnabled: chatSettings?.enabled ?? false,
            ghlEnabled: ghlSettings?.isEnabled ?? false,
            hasApiKey: !!ghlSettings?.apiKey,
            hasCalendarId: !!ghlSettings?.calendarId,
            hasLocationId: !!ghlSettings?.locationId,
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// GET /api/chat/conversations — list all conversations (admin)
router.get("/chat/conversations", requireAdmin, async (_req, res) => {
    try {
        const convs = await storage.getConversations();
        // Debug: log first conversation's lastMessage to verify fix
        if (convs.length > 0) {
            console.log(`[DEBUG] getConversations: ${convs.length} convs, first.lastMessage = "${convs[0].lastMessage?.substring(0, 50) ?? 'NULL'}"`);
        }
        res.json(convs);
    } catch (err) {
        console.error('[DEBUG] getConversations error:', err);
        res.status(500).json({ message: (err as Error).message });
    }
});

// GET /api/chat/conversations/:id — single conversation detail (admin)
router.get("/chat/conversations/:id", requireAdmin, async (req, res) => {
    try {
        const conversation = await storage.getConversation(req.params.id);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        res.json(conversation);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// POST /api/chat/conversations/:id/status — update conversation status (admin)
router.post("/chat/conversations/:id/status", requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status || !["active", "open", "closed", "archived"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const conversation = await storage.updateConversation(req.params.id, { status });
        res.json(conversation);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// DELETE /api/chat/conversations/:id — delete conversation and its messages (admin)
router.delete("/chat/conversations/:id", requireAdmin, async (req, res) => {
    try {
        await storage.deleteConversation(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// SSE Stream for real-time conversation updates (Admin)
// GET /api/chat/conversations/:conversationId/stream
router.get("/chat/conversations/:conversationId/stream", (req, res) => {
    const { conversationId } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const onNewMessage = (data: any) => {
        if (data.conversationId === conversationId) {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    };

    conversationEvents.on("new_message", onNewMessage);

    req.on("close", () => {
        conversationEvents.off("new_message", onNewMessage);
    });
});

export default router;
