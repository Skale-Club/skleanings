import { Router } from "express";
import { storage } from "../../storage";
import { requireAdmin } from "../../lib/auth";
import { getConnectAuthUrl, exchangeConnectCode, deauthorizeConnectAccount } from "../../lib/stripe";

const router = Router();

router.get("/stripe", requireAdmin, async (_req, res) => {
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

router.get("/stripe/connect", requireAdmin, async (_req, res) => {
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

router.delete("/stripe/disconnect", requireAdmin, async (_req, res) => {
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
