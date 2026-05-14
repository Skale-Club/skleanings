/**
 * Billing webhook handler — Phase 48
 *
 * IMPORTANT: This handler is mounted in server/index.ts BEFORE express.json()
 * using express.raw({ type: 'application/json' }). req.body is a Buffer here.
 * Do NOT add this router to registerRoutes() — it must bypass resolveTenantMiddleware.
 */

import { type Request, type Response } from "express";
import Stripe from "stripe";
import { db } from "../db";
import { tenantSubscriptions } from "@shared/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function billingWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({ message: "Missing stripe-signature header or STRIPE_WEBHOOK_SECRET" });
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body is a Buffer (express.raw middleware — raw body preserved)
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[billing/webhook] Signature verification failed:", message);
    res.status(400).json({ message: `Webhook signature verification failed: ${message}` });
    return;
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        // Look up tenant by stripeCustomerId — global registry, use db directly
        const [subRow] = await db
          .select()
          .from(tenantSubscriptions)
          .where(eq(tenantSubscriptions.stripeCustomerId, stripeCustomerId));

        if (!subRow) {
          console.warn("[billing/webhook] No tenant_subscriptions row for customer:", stripeCustomerId);
          // Acknowledge to Stripe — unknown customer is not a processing error
          res.status(200).json({ received: true });
          return;
        }

        const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
        // In Stripe SDK v21, current_period_end lives on SubscriptionItem, not Subscription
        const firstItem = sub.items.data[0];
        const periodEnd = firstItem?.current_period_end;
        await db
          .update(tenantSubscriptions)
          .set({
            stripeSubscriptionId: sub.id,
            status,
            planId: firstItem?.price.id ?? null,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            updatedAt: new Date(),
          })
          .where(eq(tenantSubscriptions.tenantId, subRow.tenantId));

        console.log(`[billing/webhook] ${event.type} processed for tenant ${subRow.tenantId}, status=${status}`);
        break;
      }

      default:
        // Unhandled event types — acknowledge without processing
        break;
    }

    res.status(200).json({ received: true });
  } catch (err: unknown) {
    console.error("[billing/webhook] Processing error:", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
}
