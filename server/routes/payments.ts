import { Router } from "express";
import { z } from "zod";
import { linkBookingToAttribution, recordConversionEvent } from "../storage/analytics";
import { insertBookingSchema } from "@shared/schema";
import { checkAvailability } from "../lib/availability";
import { calculateCartItemPrice } from "../lib/pricing";
import {
  createCheckoutSession,
  retrieveCheckoutSession,
  verifyWebhookEvent,
} from "../lib/stripe";

const router = Router();

// POST /api/payments/checkout
// Creates a booking with pending_payment status + Stripe Checkout session.
// Returns { sessionUrl, bookingId } — client redirects to sessionUrl.
router.post("/checkout", async (req, res) => {
  const storage = res.locals.storage!;
  try {
    // Check Stripe is connected + enabled
    const stripeCreds = await storage.getIntegrationSettings("stripe");
    if (!stripeCreds?.apiKey || !stripeCreds?.isEnabled) {
      return res.status(501).json({
        message: "Stripe not connected. Connect your Stripe account in Admin → Integrations.",
      });
    }

    // Validate booking data (same schema as POST /api/bookings)
    const validatedData = insertBookingSchema.parse(req.body);
    // D-07: visitorId is outside insertBookingSchema — Zod strips unknown fields, read before they're lost
    const visitorId = req.body.visitorId as string | undefined;

    // Availability check
    const isAvailable = await checkAvailability(
      storage,
      validatedData.bookingDate,
      validatedData.startTime,
      validatedData.endTime,
    );
    if (!isAvailable) {
      return res.status(409).json({ message: "Time slot is no longer available" });
    }

    // Build bookingItemsData + line items for Stripe
    let bookingItemsData: any[] | undefined;
    const lineItems: { name: string; amountCents: number; quantity: number }[] = [];

    if (validatedData.cartItems && validatedData.cartItems.length > 0) {
      bookingItemsData = [];
      for (const cartItem of validatedData.cartItems) {
        const service = await storage.getService(cartItem.serviceId);
        if (!service) continue;
        const options = await storage.getServiceOptions(service.id);
        const frequencies = await storage.getServiceFrequencies(service.id);
        const calculated = await calculateCartItemPrice(service, cartItem, options, frequencies);
        bookingItemsData.push({
          serviceId: service.id,
          serviceName: service.name,
          price: calculated.price.toFixed(2),
          quantity: cartItem.quantity || 1,
          pricingType: service.pricingType || "fixed_item",
          areaSize: calculated.areaSize,
          areaValue: calculated.areaValue?.toString(),
          selectedOptions: calculated.selectedOptions,
          selectedFrequency: calculated.selectedFrequency,
          customerNotes: cartItem.customerNotes,
          priceBreakdown: calculated.breakdown,
        });
        lineItems.push({
          name: service.name,
          amountCents: Math.round(calculated.price * 100),
          quantity: cartItem.quantity || 1,
        });
      }
    }

    // Fallback line item if cart is empty or items failed to resolve
    if (lineItems.length === 0) {
      const totalCents = Math.round(Number(validatedData.totalPrice) * 100);
      lineItems.push({ name: "Cleaning Service", amountCents: totalCents, quantity: 1 });
    }

    // Create booking with pending_payment status
    const booking = await storage.createBooking({
      ...validatedData,
      paymentStatus: "pending_payment",
      bookingItemsData,
    });

    // Attribution: link booking to visitor session — fire-and-forget (D-05: conversion event fires in webhook only)
    try {
      if (visitorId) {
        await linkBookingToAttribution(booking.id, visitorId);
      }
    } catch (attrErr) {
      console.error("Checkout attribution error:", attrErr);
    }

    // Create Stripe Checkout session
    const origin = `${req.protocol}://${req.get("host")}`;
    const session = await createCheckoutSession(storage, {
      bookingId: booking.id,
      customerEmail: validatedData.customerEmail || undefined,
      lineItems,
      successUrl: `${origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/booking?cancelled=1`,
    });

    // Store session ID on booking
    await storage.updateBookingStripeFields(booking.id, session.id);

    res.json({ sessionUrl: session.url, bookingId: booking.id });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: err.errors });
    }
    res.status(500).json({ message: (err as Error).message });
  }
});

// POST /api/payments/webhook
// Stripe sends events here. Verifies signature using req.rawBody (captured globally).
// Handles checkout.session.completed → marks booking paid.
router.post("/webhook", async (req, res) => {
  const storage = res.locals.storage!;
  const signature = req.headers["stripe-signature"] as string;
  if (!signature) return res.status(400).send("Missing stripe-signature header");

  let event;
  try {
    event = await verifyWebhookEvent(storage, req.rawBody as Buffer, signature);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const bookingId = session.metadata?.bookingId ? Number(session.metadata.bookingId) : null;

    if (bookingId) {
      try {
        await storage.updateBookingStripeFields(bookingId, session.id, session.payment_status);
        if (session.payment_status === "paid") {
          await storage.updateBooking(bookingId, { paymentStatus: "paid" });
          // D-05: Stripe path records booking_completed ONLY from webhook (not checkout handler)
          // D-04: if utm_session_id is null on booking row, writes null attribution — event is preserved
          try {
            await recordConversionEvent('booking_completed', {
              bookingId,
            });
          } catch (convErr) {
            console.error("Webhook conversion event error:", convErr);
          }
        }
      } catch (err) {
        console.error("Webhook booking update error:", err);
      }
    }
  }

  res.json({ received: true });
});

// GET /api/payments/verify/:sessionId
// Called by confirmation page to check payment status after Stripe redirect.
router.get("/verify/:sessionId", async (req, res) => {
  const storage = res.locals.storage!;
  try {
    const { sessionId } = req.params;
    const session = await retrieveCheckoutSession(storage, sessionId);
    const booking = await storage.getBookingByStripeSessionId(sessionId);

    res.json({
      paid: session.payment_status === "paid",
      bookingId: booking?.id ?? null,
      booking: booking ?? null,
    });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

export default router;
