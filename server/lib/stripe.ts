import Stripe from "stripe";
import { storage } from "../storage";

/**
 * Returns a Stripe client initialized with the connected account's access_token.
 * Used for creating charges on behalf of the connected Stripe account.
 */
async function getStripeClient(): Promise<Stripe> {
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
  params: CheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const stripe = await getStripeClient();
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
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = await getStripeClient();
  return stripe.checkout.sessions.retrieve(sessionId);
}

export async function verifyWebhookEvent(
  rawBody: Buffer,
  signature: string
): Promise<Stripe.Event> {
  const creds = await storage.getIntegrationSettings("stripe");
  if (!creds?.calendarId) {
    throw new Error("Stripe webhook secret not configured.");
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY env var not set.");
  const stripe = new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });
  return stripe.webhooks.constructEvent(rawBody, signature, creds.calendarId);
}
