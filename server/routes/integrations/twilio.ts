import { Router } from "express";
import { storage } from "../../storage";
import { requireAdmin } from "../../lib/auth";

const router = Router();

router.get("/twilio", requireAdmin, async (_req, res) => {
    try {
        const settings = await storage.getTwilioSettings();
        if (!settings) {
            return res.json({ enabled: false, accountSid: "", authToken: "", fromPhoneNumber: "", toPhoneNumbers: [], notifyOnNewChat: true });
        }
        res.json({ ...settings, authToken: settings.authToken ? "********" : "" });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put("/twilio", requireAdmin, async (req, res) => {
    try {
        const { accountSid, authToken, fromPhoneNumber, toPhoneNumbers, notifyOnNewChat, enabled } = req.body;
        const existingSettings = await storage.getTwilioSettings();

        const settingsToSave: any = {
            accountSid,
            fromPhoneNumber,
            toPhoneNumbers: toPhoneNumbers || [],
            notifyOnNewChat: notifyOnNewChat ?? true,
            enabled: enabled ?? false,
        };

        if (authToken && authToken !== "********") {
            settingsToSave.authToken = authToken;
        } else if (existingSettings?.authToken) {
            settingsToSave.authToken = existingSettings.authToken;
        }

        const settings = await storage.saveTwilioSettings(settingsToSave);
        res.json({ ...settings, authToken: settings.authToken ? "********" : "" });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

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
                message: "All fields are required to test Twilio connection, including at least one phone number",
            });
        }

        const twilio = await import("twilio");
        const client = twilio.default(accountSid, tokenToTest);
        for (const phoneNumber of toPhoneNumbers) {
            await client.messages.create({ body: "Test message - Your Twilio integration is working!", from: fromPhoneNumber, to: phoneNumber });
        }

        res.json({ success: true, message: `Test SMS sent successfully to ${toPhoneNumbers.length} number(s)!` });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err?.message || "Failed to send test SMS" });
    }
});

export default router;
