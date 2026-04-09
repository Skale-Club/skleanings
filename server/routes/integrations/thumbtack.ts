import { Router } from "express";
import { requireAdmin } from "../../lib/auth";
import { exchangeCodeForTokens, buildAuthorizationUrl } from "../../integrations/thumbtack";
import crypto from "crypto";

const router = Router();

router.get("/thumbtack/callback", async (req, res) => {
    try {
        const { code, state, error } = req.query;

        if (error) {
            console.error("Thumbtack OAuth error:", error);
            return res.status(400).json({ success: false, message: `Thumbtack authorization failed: ${error}` });
        }

        if (!code || typeof code !== "string") {
            return res.status(400).json({ success: false, message: "Missing authorization code from Thumbtack" });
        }

        const clientId = process.env.THUMBTACK_CLIENT_ID;
        const clientSecret = process.env.THUMBTACK_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(500).json({ success: false, message: "Thumbtack client credentials not configured" });
        }

        const baseUrl = process.env.SITE_URL || "https://www.skleanings.com";
        const redirectUri = `${baseUrl}/api/integrations/thumbtack/callback`;

        const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
        console.log("Thumbtack OAuth success - tokens received", {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            expiresIn: tokens.expires_in,
            state,
        });

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
        res.status(500).json({ success: false, message: (err as Error).message });
    }
});

router.get("/thumbtack/authorize", requireAdmin, async (_req, res) => {
    try {
        const clientId = process.env.THUMBTACK_CLIENT_ID;
        if (!clientId) {
            return res.status(500).json({ success: false, message: "Thumbtack client ID not configured" });
        }

        const baseUrl = process.env.SITE_URL || "https://www.skleanings.com";
        const redirectUri = `${baseUrl}/api/integrations/thumbtack/callback`;
        const state = crypto.randomBytes(16).toString("hex");
        const authUrl = buildAuthorizationUrl(clientId, redirectUri, ["offline_access"], state);
        res.redirect(authUrl);
    } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
    }
});

export default router;
