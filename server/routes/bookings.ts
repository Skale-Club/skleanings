
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";
import { insertBookingSchema, insertBookingSchemaBase } from "@shared/schema";
import { checkAvailability } from "../lib/availability";
import { canCreateBooking, recordBookingCreation } from "../lib/rate-limit";
import { acquireTimeSlotLock, releaseTimeSlotLock } from "../lib/time-slot-lock";
import { syncBookingToGhl } from "../lib/booking-ghl-sync";
import { sendBookingNotification } from "../integrations/twilio";
import { sendBookingNotification as sendTelegramBookingNotification } from "../integrations/telegram";
import { calculateCartItemPrice } from "../lib/pricing";

const router = Router();

// Bookings
router.get('/', requireAdmin, async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const bookings = await storage.getBookings(limit);
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
                });
            }
        }

        const booking = await storage.createBooking({
            ...validatedData,
            bookingItemsData,
        });

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

            const [twilioSettings, telegramSettings] = await Promise.all([
                storage.getTwilioSettings(),
                storage.getTelegramSettings(),
            ]);

            if (twilioSettings?.enabled && twilioSettings.authToken && twilioSettings.fromPhoneNumber) {
                try {
                    await sendBookingNotification(booking, serviceNames, twilioSettings);
                } catch (twilioError) {
                    console.error("Twilio Notification Error:", twilioError);
                }
            }

            if (telegramSettings?.enabled && telegramSettings.botToken && telegramSettings.chatIds.length > 0) {
                try {
                    await sendTelegramBookingNotification(booking, serviceNames, telegramSettings);
                } catch (telegramError) {
                    console.error("Telegram Notification Error:", telegramError);
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
