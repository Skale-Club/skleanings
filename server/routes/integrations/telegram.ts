import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../../lib/auth";
import { insertTelegramSettingsSchema } from "@shared/schema";
import {
    hasTelegramCredentials,
    isMaskedToken,
    isValidTelegramBotToken,
    maskToken,
    sendTelegramTestMessage,
} from "../../integrations/telegram";

const router = Router();

router.get("/telegram", requireAdmin, async (_req, res) => {
    const storage = res.locals.storage!;
    try {
        const settings = await storage.getTelegramSettings();
        if (!settings) {
            return res.json({ enabled: false, botToken: "", chatIds: [], notifyOnNewChat: true });
        }
        res.json({ ...settings, botToken: maskToken(settings.botToken) });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put("/telegram", requireAdmin, async (req, res) => {
    const storage = res.locals.storage!;
    try {
        const payload = insertTelegramSettingsSchema.partial().parse(req.body);
        const existingSettings = await storage.getTelegramSettings();

        const incomingToken = payload.botToken?.trim();
        if (incomingToken && !isMaskedToken(incomingToken) && !isValidTelegramBotToken(incomingToken)) {
            return res.status(400).json({ message: "Bot token format is invalid. Expected format: <digits>:<token>" });
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
        res.json({ ...settings, botToken: maskToken(settings.botToken) });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: err.errors });
        res.status(400).json({ message: (err as Error).message });
    }
});

router.post("/telegram/test", requireAdmin, async (req, res) => {
    const storage = res.locals.storage!;
    try {
        const bodySchema = z.object({ botToken: z.string().optional(), chatIds: z.array(z.string()).optional() });
        const { botToken, chatIds } = bodySchema.parse(req.body || {});
        const existingSettings = await storage.getTelegramSettings();
        const companySettings = await storage.getCompanySettings();

        const incomingToken = botToken?.trim();
        if (incomingToken && !isMaskedToken(incomingToken) && !isValidTelegramBotToken(incomingToken)) {
            return res.status(400).json({ success: false, message: "Bot token format is invalid. Expected format: <digits>:<token>" });
        }

        const tokenToTest = incomingToken && !isMaskedToken(incomingToken) ? incomingToken : existingSettings?.botToken;
        const chatIdsToTest = chatIds
            ? Array.from(new Set(chatIds.map((chatId) => chatId.trim()).filter(Boolean)))
            : (existingSettings?.chatIds || []);

        const settingsToTest = {
            enabled: true,
            botToken: tokenToTest || "",
            chatIds: chatIdsToTest,
            notifyOnNewChat: existingSettings?.notifyOnNewChat ?? true,
            id: existingSettings?.id ?? 0,
            tenantId: existingSettings?.tenantId ?? 1,
            createdAt: existingSettings?.createdAt ?? new Date(),
            updatedAt: existingSettings?.updatedAt ?? new Date(),
        };

        if (!hasTelegramCredentials(settingsToTest)) {
            return res.status(400).json({ success: false, message: "Bot token and at least one chat ID are required" });
        }

        const companyNameForTest =
            (companySettings?.companyName || "").trim() ||
            (companySettings?.ogSiteName || "").trim() ||
            (process.env.WHITE_LABEL_NAME || "").trim() ||
            (process.env.COMPANY_NAME || "").trim() ||
            "Skleanings";

        const result = await sendTelegramTestMessage(storage, settingsToTest, companyNameForTest);
        if (!result.success) {
            return res.status(500).json({ success: false, message: result.message || "Failed to send Telegram test message" });
        }

        res.json({ success: true, message: "Test message sent successfully", companyNameUsed: companyNameForTest });
    } catch (err: any) {
        if (err instanceof z.ZodError) return res.status(400).json({ success: false, message: "Validation error", errors: err.errors });
        res.status(500).json({ success: false, message: err?.message || "Failed to send Telegram test message" });
    }
});

export default router;
