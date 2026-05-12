import { Router } from "express";
import { storage } from "../../storage";
import { requireAdmin } from "../../lib/auth";

const router = Router();

// GET /api/integrations/resend — returns settings with masked API key
router.get("/resend", requireAdmin, async (_req, res) => {
  try {
    const settings = await storage.getEmailSettings();
    if (!settings) {
      return res.json({ enabled: false, resendApiKey: "", fromAddress: "" });
    }
    res.json({ ...settings, resendApiKey: settings.resendApiKey ? "********" : "" });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// PUT /api/integrations/resend — upserts settings; preserves existing key if "********" submitted
router.put("/resend", requireAdmin, async (req, res) => {
  try {
    const { resendApiKey, fromAddress, enabled } = req.body;
    const existingSettings = await storage.getEmailSettings();

    const settingsToSave: Record<string, unknown> = {
      fromAddress: fromAddress ?? "",
      enabled: enabled ?? false,
    };

    if (resendApiKey && resendApiKey !== "********") {
      settingsToSave.resendApiKey = resendApiKey;
    } else if (existingSettings?.resendApiKey) {
      settingsToSave.resendApiKey = existingSettings.resendApiKey;
    }

    const settings = await storage.saveEmailSettings(settingsToSave as Parameters<typeof storage.saveEmailSettings>[0]);
    res.json({ ...settings, resendApiKey: settings.resendApiKey ? "********" : "" });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

// POST /api/integrations/resend/test — sends a test email to the configured fromAddress
router.post("/resend/test", requireAdmin, async (req, res) => {
  try {
    const { resendApiKey, fromAddress } = req.body;

    let keyToTest = resendApiKey;
    if (!keyToTest || keyToTest === "********") {
      const existingSettings = await storage.getEmailSettings();
      keyToTest = existingSettings?.resendApiKey;
    }

    if (!keyToTest) {
      return res.status(400).json({ success: false, message: "API key is required to send a test email" });
    }

    const toAddress = fromAddress || (await storage.getEmailSettings())?.fromAddress;
    if (!toAddress) {
      return res.status(400).json({ success: false, message: "From address is required to send a test email" });
    }

    const { Resend } = await import("resend");
    const resend = new Resend(keyToTest);
    const { error } = await resend.emails.send({
      from: toAddress,
      to: toAddress,
      subject: "Test email — Resend integration",
      html: "<p>Your Resend integration is working correctly!</p>",
      text: "Your Resend integration is working correctly!",
    });

    if (error) {
      return res.status(500).json({ success: false, message: (error as { message?: string }).message || "Resend returned an error" });
    }

    res.json({ success: true, message: "Test email sent successfully! Check your inbox." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send test email";
    res.status(500).json({ success: false, message });
  }
});

export default router;
