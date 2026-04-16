import { Router } from "express";
import { storage } from "../../storage";
import { requireAdmin } from "../../lib/auth";

const router = Router();

router.get("/google-calendar", requireAdmin, async (_req, res) => {
    try {
        const settings = await storage.getIntegrationSettings("google-calendar");
        if (!settings) {
            return res.json({ provider: "google-calendar", apiKey: "", locationId: "", calendarId: "", isEnabled: false });
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

router.put("/google-calendar", requireAdmin, async (req, res) => {
    try {
        const { apiKey, locationId, calendarId, isEnabled } = req.body;
        const existingSettings = await storage.getIntegrationSettings("google-calendar");

        const settingsToSave: any = {
            provider: "google-calendar",
            calendarId: calendarId || "",
            isEnabled: isEnabled ?? false,
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

router.post("/google-calendar/test", requireAdmin, async (_req, res) => {
    try {
        const settings = await storage.getIntegrationSettings("google-calendar");
        if (!settings?.apiKey || !settings?.locationId) {
            return res.status(400).json({ ok: false, message: "Client ID and Client Secret are not saved yet." });
        }
        if (!settings.calendarId) {
            return res.status(400).json({ ok: false, message: "Redirect URI is not saved yet." });
        }

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
            return res.json({ ok: true, message: "Credentials are valid. Google recognised your Client ID and Secret." });
        }

        return res.json({ ok: false, message: data.error_description || `Unexpected response from Google: ${err}` });
    } catch (err) {
        res.status(500).json({ ok: false, message: (err as Error).message });
    }
});

export default router;
