import Stripe from "stripe";
import type { IStorage } from "../storage";

/**
 * Returns a Stripe client initialized with the connected account's access_token.
 * Used for creating charges on behalf of the connected Stripe account.
 */
async function getStripeClient(storage: IStorage): Promise<Stripe> {
  const creds = await storage.getIntegrationSettings("stripe");
  if (!creds?.apiKey) {
    throw new Error("Stripe not connected. Connect your Stripe account in Admin → Integrations.");
  }
  return new Stripe(creds.apiKey, { apiVersion: "2026-03-25.dahlia" });
}

// ─── Stripe Connect OAuth ─────────────────────────────────────────────────────

/**
 * Builds the Stripe Connect OAuth authorization URL.
 * Requires STRIPE_CLIENT_ID env var (platform-level config).
 */
export function getConnectAuthUrl(): string {
  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId) throw new Error("STRIPE_CLIENT_ID env var not set.");
  const redirectUri = process.env.STRIPE_REDIRECT_URI || "";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchanges a Stripe Connect OAuth code for an access_token + stripe_user_id.
 * Uses the platform STRIPE_SECRET_KEY env var (not the connected account's key).
 */
export async function exchangeConnectCode(
  code: string
): Promise<{ accessToken: string; stripeUserId: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY env var not set.");
  const stripe = new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });
  const response = await stripe.oauth.token({ grant_type: "authorization_code", code });
  if (!response.access_token || !response.stripe_user_id) {
    throw new Error("Stripe Connect token exchange did not return required fields.");
  }
  return { accessToken: response.access_token, stripeUserId: response.stripe_user_id };
}

/**
 * Revokes the connected Stripe account's access.
 * Uses the platform STRIPE_CLIENT_ID + STRIPE_SECRET_KEY env vars.
 */
export async function deauthorizeConnectAccount(stripeUserId: string): Promise<void> {
  const clientId = process.env.STRIPE_CLIENT_ID;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!clientId || !secretKey) return;
  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });
    await stripe.oauth.deauthorize({ client_id: clientId, stripe_user_id: stripeUserId });
  } catch {
    // Deauthorize failure is non-fatal — clear tokens regardless
  }
}

// ─── Checkout + Webhook helpers ───────────────────────────────────────────────

export interface CheckoutLineItem {
  name: string;
  amountCents: number; // unit_amount in cents (integer)
  quantity: number;
}

export interface CheckoutSessionParams {
  bookingId: number;
  customerEmail?: string;
  lineItems: CheckoutLineItem[];
  successUrl: string; // include {CHECKOUT_SESSION_ID} placeholder
  cancelUrl: string;
}

export async function createCheckoutSession(
  storage: IStorage,
  params: CheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const stripe = await getStripeClient(storage);
  return stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: params.customerEmail || undefined,
    line_items: params.lineItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: { name: item.name },
        unit_amount: item.amountCents,
      },
      quantity: item.quantity,
    })),
    metadata: { bookingId: String(params.bookingId) },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
}

export async function retrieveCheckoutSession(
  storage: IStorage,
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = await getStripeClient(storage);
  return stripe.checkout.sessions.retrieve(sessionId);
}

export async function verifyWebhookEvent(
  storage: IStorage,
  rawBody: Buffer,
  signature: string
): Promise<Stripe.Event> {
  const platformKey = process.env.STRIPE_SECRET_KEY;
  if (!platformKey) throw new Error("STRIPE_SECRET_KEY env var not set.");
  const stripe = new Stripe(platformKey, { apiVersion: "2026-03-25.dahlia" });

  // PF-06: Connect events are signed with STRIPE_WEBHOOK_SECRET_CONNECT (platform-level webhook).
  // Try Connect secret first; on signature mismatch, fall back to legacy per-tenant secret.
  const connectSecret = process.env.STRIPE_WEBHOOK_SECRET_CONNECT;
  if (connectSecret) {
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, connectSecret);
    } catch {
      // Signature did not match Connect secret — fall through to legacy path.
    }
  }

  // Legacy per-tenant secret stored in integrationSettings.stripe.calendarId
  // (field name predates Phase 65 — misleading but stable).
  const creds = await storage.getIntegrationSettings("stripe");
  if (!creds?.calendarId) {
    throw new Error("Stripe webhook secret not configured.");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, creds.calendarId);
}

/**
 * Phase 65 (PF-06) — retrieve a Checkout session FROM A CONNECTED ACCOUNT.
 * Connect events arrive at the platform endpoint with event.account set; the underlying
 * session lives on that connected account and must be fetched via the Stripe-Account header.
 * Expands payment_intent so caller can read application_fee_amount.
 */
export async function retrieveCheckoutSessionForAccount(
  sessionId: string,
  stripeAccount: string,
): Promise<Stripe.Checkout.Session> {
  const platformKey = process.env.STRIPE_SECRET_KEY;
  if (!platformKey) throw new Error("STRIPE_SECRET_KEY env var not set.");
  const stripe = new Stripe(platformKey, { apiVersion: "2026-03-25.dahlia" });
  return stripe.checkout.sessions.retrieve(
    sessionId,
    { expand: ["payment_intent"] },
    { stripeAccount },
  );
}
