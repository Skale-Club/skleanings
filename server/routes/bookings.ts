
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { linkBookingToAttribution, recordConversionEvent } from "../storage/analytics";
import { requireAdmin, getAuthenticatedUser } from "../lib/auth";
import { insertBookingSchema, insertBookingSchemaBase } from "@shared/schema";
import { checkAvailability } from "../lib/availability";
import { canCreateBooking, recordBookingCreation } from "../lib/rate-limit";
import { acquireTimeSlotLock, releaseTimeSlotLock } from "../lib/time-slot-lock";
import { syncBookingToGhl } from "../lib/booking-ghl-sync";
import { sendBookingNotification, sendAwaitingApprovalNotification } from "../integrations/twilio";
import { sendBookingNotification as sendTelegramBookingNotification, sendAwaitingApprovalNotification as sendTelegramAwaitingApprovalNotification } from "../integrations/telegram";
import { calculateCartItemPrice } from "../lib/pricing";

const router = Router();

// Bookings
router.get('/', requireAdmin, async (req, res) => {
    try {
        const { from, to, limit } = req.query;
        if (from && to && typeof from === 'string' && typeof to === 'string') {
            const bookings = await storage.getBookingsByDateRange(from, to);
            return res.json(bookings);
        }
        const limitNum = limit ? Number(limit) : 50;
        const bookings = await storage.getBookings(limitNum);
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.get('/:id(\\d+)', requireAdmin, async (req, res) => {
    try {
        const booking = await storage.getBooking(Number(req.params.id));
        if (!booking) return res.status(404).json({ message: "Booking not found" });
        res.json(booking);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.get('/:id(\\d+)/items', requireAdmin, async (req, res) => {
    try {
        const items = await storage.getBookingItems(Number(req.params.id));
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post('/', async (req, res) => {
    try {
        const validatedData = insertBookingSchema.parse(req.body);

        // Check local availability
        const isAvailable = await checkAvailability(
            validatedData.bookingDate,
            validatedData.startTime,
            validatedData.endTime,
            undefined // No specific booking ID to exclude
        );

        if (!isAvailable) {
            return res.status(409).json({ message: "Time slot is no longer available" });
        }

        // Convert cartItems to bookingItemsData (same format used by chat)
        let bookingItemsData: any[] | undefined;
        if (validatedData.cartItems && validatedData.cartItems.length > 0) {
            bookingItemsData = [];
            for (const cartItem of validatedData.cartItems) {
                const service = await storage.getService(cartItem.serviceId);
                if (!service) continue;
                const options = await storage.getServiceOptions(service.id);
                const frequencies = await storage.getServiceFrequencies(service.id);
                const calculated = await calculateCartItemPrice(service, cartItem, options, frequencies);

                // Phase 30 DUR-04/DUR-05: resolve chosen duration for snapshot
                let durationLabel: string | null = null;
                let resolvedDurationMinutes: number | null = null;
                if (cartItem.selectedDurationId) {
                    const chosenDuration = await storage.getServiceDuration(cartItem.selectedDurationId);
                    if (chosenDuration) {
                        durationLabel = chosenDuration.label;
                        resolvedDurationMinutes = chosenDuration.durationMinutes;
                    }
                }

                bookingItemsData.push({
                    serviceId: service.id,
                    serviceName: service.name,
                    price: calculated.price.toFixed(2),
                    quantity: cartItem.quantity || 1,
                    pricingType: service.pricingType || 'fixed_item',
                    areaSize: calculated.areaSize,
                    areaValue: calculated.areaValue?.toString(),
                    selectedOptions: calculated.selectedOptions,
                    selectedFrequency: calculated.selectedFrequency,
                    customerNotes: cartItem.customerNotes,
                    priceBreakdown: calculated.breakdown,
                    questionAnswers: cartItem.questionAnswers,
                    durationLabel,                        // Phase 30 DUR-04
                    durationMinutes: resolvedDurationMinutes, // Phase 30 DUR-04
                });
            }
        }

        let bookingUserId: string | null = null;
        try {
            const authUser = await getAuthenticatedUser(req);
            if (authUser?.role === 'client') {
                bookingUserId = authUser.id;
            }
        } catch {
            // Auth failure on a public endpoint is non-fatal — proceed as guest
        }

        // Determine if primary service requires manual confirmation
        let primaryRequiresConfirmation = false;
        try {
            const primaryServiceId = validatedData.cartItems?.[0]?.serviceId ?? validatedData.serviceIds?.[0];
            if (primaryServiceId) {
                const primaryService = await storage.getService(primaryServiceId);
                primaryRequiresConfirmation = primaryService?.requiresConfirmation ?? false;
            }
        } catch {
            // Non-fatal: if lookup fails, proceed with standard pending status
        }

        const booking = await storage.createBooking({
            ...validatedData,
            bookingItemsData,
            userId: bookingUserId,
            status: primaryRequiresConfirmation ? 'awaiting_approval' : 'pending',
        } as any);

        // Auto-link contact: upsert by email/phone, then set contactId on booking
        try {
            const contact = await storage.upsertContact({
                name: validatedData.customerName,
                email: validatedData.customerEmail || undefined,
                phone: validatedData.customerPhone,
                address: validatedData.customerAddress || undefined,
            });
            await storage.updateBookingContactId(booking.id, contact.id);
        } catch (contactErr) {
            // Non-blocking: contact linking failure never breaks booking creation
            console.error("Contact upsert error:", contactErr);
        }

        // Phase 28 RECUR-01: create recurring subscription if customer selected a frequency.
        // Non-fatal: booking succeeds even if subscription creation fails.
        const rawFrequencyId = validatedData.cartItems?.[0]?.selectedFrequencyId;
        if (rawFrequencyId) {
            try {
                const frequency = await storage.getServiceFrequency(rawFrequencyId);
                if (!frequency || !frequency.intervalDays) {
                    console.warn(`[RecurringBooking] Frequency ${rawFrequencyId} missing or has no intervalDays — skipping subscription`);
                } else {
                    const { advanceDate } = await import("../lib/date-utils");
                    const sub = await storage.createRecurringBooking({
                        contactId: booking.contactId ?? null,
                        serviceId: frequency.serviceId,
                        serviceFrequencyId: frequency.id,
                        discountPercent: frequency.discountPercent ?? "0",
                        intervalDays: frequency.intervalDays,
                        frequencyName: frequency.name,
                        startDate: validatedData.bookingDate,
                        nextBookingDate: advanceDate(validatedData.bookingDate, frequency.intervalDays),
                        preferredStartTime: validatedData.startTime,
                        preferredStaffMemberId: validatedData.staffMemberId ?? null,
                        originBookingId: booking.id,
                        status: "active",
                    });
                    // Link booking back to subscription
                    await storage.updateBooking(booking.id, { recurringBookingId: sub.id } as any);
                    console.log(`[RecurringBooking] Created subscription ${sub.id} for booking ${booking.id} (${frequency.name})`);
                    // Phase 29 RECUR-05: send manage-link email so customer can pause/cancel self-serve
                    try {
                        const { buildManageEmail } = await import("../lib/email-templates");
                        const { sendEmail } = await import("../lib/email");
                        const appUrl = process.env.APP_URL ?? process.env.SITE_URL ?? "";
                        if (!appUrl) {
                            console.warn("[RecurringBooking] APP_URL not set — manage link email skipped");
                        } else if (booking.customerEmail) {
                            const manageUrl = `${appUrl}/manage-subscription/${sub.manageToken}`;
                            const companySettings = await storage.getCompanySettings();
                            const companyName = companySettings?.companyName || "Your Cleaning Service";
                            const svc = await storage.getService(frequency.serviceId);
                            const emailContent = buildManageEmail({
                                customerName: booking.customerName,
                                serviceName: svc?.name ?? "Cleaning Service",
                                frequencyName: frequency.name,
                                manageUrl,
                                companyName,
                            });
                            await sendEmail(
                                booking.customerEmail,
                                emailContent.subject,
                                emailContent.text,
                                emailContent.html
                            );
                            console.log(`[RecurringBooking] Manage-link email sent to ${booking.customerEmail} for subscription ${sub.id}`);
                        } else {
                            console.warn(`[RecurringBooking] No customerEmail on booking ${booking.id} — manage link email skipped`);
                        }
                    } catch (emailErr) {
                        // Non-fatal: email failure never breaks booking or subscription creation
                        console.error("[RecurringBooking] Manage-link email error:", emailErr);
                    }
                }
            } catch (recurringErr) {
                console.error("[RecurringBooking] Subscription creation error:", recurringErr);
                // Do not throw — booking is already persisted successfully
            }
        }

        // Attribution wiring — fire-and-forget (EVENTS-04: must never block the booking response)
        // D-07: visitorId is outside insertBookingSchema — read directly from req.body after Zod parse
        const visitorId = req.body.visitorId as string | undefined;
        try {
            if (visitorId) {
                await linkBookingToAttribution(booking.id, visitorId);
            }
        } catch (attrErr) {
            console.error("Attribution link error:", attrErr);
        }
        try {
            await recordConversionEvent('booking_completed', {
                bookingId:    booking.id,
                bookingValue: validatedData.totalPrice,
            });
        } catch (convErr) {
            console.error("Conversion event error:", convErr);
        }

        // Sync to GHL if enabled (non-blocking for booking creation)
        const ghlSync = await syncBookingToGhl(booking);
        if (ghlSync.attempted && !ghlSync.synced) {
            console.error("GHL Sync Error:", ghlSync.reason || "Unknown error");
        }

        // Send booking notifications (non-blocking)
        try {
            const bookingItems = await storage.getBookingItems(booking.id);
            const serviceNames = bookingItems
                .map((item) => item.serviceName?.trim())
                .filter((name): name is string => Boolean(name));

            const [twilioSettings, telegramSettings, companySettings] = await Promise.all([
                storage.getTwilioSettings(),
                storage.getTelegramSettings(),
                storage.getCompanySettings(),
            ]);

            if (primaryRequiresConfirmation) {
                // Send awaiting_approval notifications instead of new_booking
                if (twilioSettings?.enabled && twilioSettings.authToken && twilioSettings.fromPhoneNumber) {
                    try {
                        await sendAwaitingApprovalNotification(
                            booking,
                            serviceNames,
                            twilioSettings,
                            companySettings?.companyName || 'the business',
                            booking.id
                        );
                    } catch (twilioError) {
                        console.error("Twilio Awaiting Approval Notification Error:", twilioError);
                    }
                }
                if (telegramSettings?.enabled && telegramSettings.botToken && telegramSettings.chatIds.length > 0) {
                    try {
                        await sendTelegramAwaitingApprovalNotification(
                            booking,
                            serviceNames,
                            telegramSettings,
                            companySettings?.companyName || 'the business',
                            booking.id
                        );
                    } catch (telegramError) {
                        console.error("Telegram Awaiting Approval Notification Error:", telegramError);
                    }
                }
            } else {
                // Existing new_booking notifications (no change)
                if (twilioSettings?.enabled && twilioSettings.authToken && twilioSettings.fromPhoneNumber) {
                    try {
                        await sendBookingNotification(
                            booking,
                            serviceNames,
                            twilioSettings,
                            companySettings?.companyName || 'the business',
                            booking.id
                        );
                    } catch (twilioError) {
                        console.error("Twilio Notification Error:", twilioError);
                    }
                }

                if (telegramSettings?.enabled && telegramSettings.botToken && telegramSettings.chatIds.length > 0) {
                    try {
                        await sendTelegramBookingNotification(
                            booking,
                            serviceNames,
                            telegramSettings,
                            companySettings?.companyName || 'the business',
                            booking.id
                        );
                    } catch (telegramError) {
                        console.error("Telegram Notification Error:", telegramError);
                    }
                }
            }
        } catch (error) {
            console.error("Booking Notification Error:", error);
        }

        const latestBooking = await storage.getBooking(booking.id);
        res.status(201).json(latestBooking || booking);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

async function handleBookingUpdate(req: any, res: any) {
    try {
        const validatedData = insertBookingSchemaBase.partial().parse(req.body);
        const booking = await storage.updateBooking(Number(req.params.id), validatedData);
        res.json(booking);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
}

router.put('/:id(\\d+)', requireAdmin, handleBookingUpdate);
router.patch('/:id(\\d+)', requireAdmin, handleBookingUpdate);

router.put('/:id(\\d+)/status', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ message: "Status is required" });

        const booking = await storage.updateBookingStatus(Number(req.params.id), status);
        res.json(booking);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Approve a booking awaiting confirmation — sets status to confirmed
router.put('/:id(\\d+)/approve', requireAdmin, async (req, res) => {
    try {
        const booking = await storage.updateBookingStatus(Number(req.params.id), 'confirmed');
        res.json(booking);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Reject a booking awaiting confirmation — sets status to cancelled
// Optional: { reason: string } in body, stored via generic updateBooking
router.put('/:id(\\d+)/reject', requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        await storage.updateBookingStatus(id, 'cancelled');
        // If a reason was provided, log it server-side
        // (bookings table has no notes column — Plan 03 UI will pass reason in request body)
        const { reason } = req.body as { reason?: string };
        if (reason) {
            console.log(`Booking ${id} rejected. Reason: ${reason}`);
        }
        const booking = await storage.getBooking(id);
        res.json(booking);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.delete('/:id(\\d+)', requireAdmin, async (req, res) => {
    try {
        await storage.deleteBooking(Number(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// Availability
router.get('/availability/check', async (req, res) => {
    try {
        const { date, startTime, endTime } = req.query;

        if (!date || !startTime || !endTime) {
            return res.status(400).json({ message: "Date, start time and end time are required" });
        }

        const isAvailable = await checkAvailability(
            date as string,
            startTime as string,
            endTime as string
        );

        res.json({ available: isAvailable });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

export default router;
