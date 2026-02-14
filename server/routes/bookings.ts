
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";
import { insertBookingSchema, insertBookingSchemaBase } from "@shared/schema";
import { checkAvailability } from "../lib/availability";
import { canCreateBooking, recordBookingCreation } from "../lib/rate-limit";
import { acquireTimeSlotLock, releaseTimeSlotLock } from "../lib/time-slot-lock";
import {
    createGHLAppointment,
    getOrCreateGHLContact,
    formatDateTimeWithTimezone
} from "../integrations/ghl";
import { sendBookingNotification } from "../integrations/twilio";

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

router.get('/:id', requireAdmin, async (req, res) => {
    try {
        const booking = await storage.getBooking(Number(req.params.id));
        if (!booking) return res.status(404).json({ message: "Booking not found" });
        res.json(booking);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post('/', async (req, res) => {
    try {
        const validatedData = insertBookingSchema.parse(req.body);
        const bookingSchemaData = validatedData;

        // Check local availability
        const isAvailable = await checkAvailability(
            bookingSchemaData.bookingDate,
            bookingSchemaData.startTime,
            bookingSchemaData.endTime,
            undefined // No specific booking ID to exclude
        );

        if (!isAvailable) {
            return res.status(409).json({ message: "Time slot is no longer available" });
        }

        const booking = await storage.createBooking(validatedData);

        // Sync to GHL if enabled
        try {
            const ghlSettings = await storage.getIntegrationSettings('gohighlevel');
            if (ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.locationId && ghlSettings.calendarId) {

                // 1. Create/Update Contact
                const nameParts = booking.customerName.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                const contactResult = await getOrCreateGHLContact(
                    ghlSettings.apiKey,
                    ghlSettings.locationId,
                    {
                        email: booking.customerEmail || '',
                        firstName,
                        lastName,
                        phone: booking.customerPhone,
                        address: booking.customerAddress
                    }
                );

                if (contactResult.success && contactResult.contactId) {
                    // 2. Create Appointment
                    const companySettings = await storage.getCompanySettings();
                    const timeZone = companySettings?.timeZone || 'America/New_York';

                    const appointmentResult = await createGHLAppointment(
                        ghlSettings.apiKey,
                        ghlSettings.calendarId,
                        ghlSettings.locationId,
                        {
                            contactId: contactResult.contactId,
                            startTime: formatDateTimeWithTimezone(booking.bookingDate, booking.startTime, timeZone),
                            endTime: formatDateTimeWithTimezone(booking.bookingDate, booking.endTime, timeZone),
                            title: `Cleaning: ${booking.customerName} - ${booking.totalDurationMinutes} mins`,
                            address: booking.customerAddress
                        }
                    );

                    // Update sync status
                    await storage.updateBookingGHLSync(
                        booking.id,
                        contactResult.contactId,
                        appointmentResult.appointmentId || '',
                        appointmentResult.success ? 'synced' : 'failed'
                    );
                }
            }
        } catch (error) {
            console.error("GHL Sync Error:", error);
            // Don't fail the request, just log error
        }

        // Send SMS notification via Twilio
        try {
            const twilioSettings = await storage.getTwilioSettings();
            if (twilioSettings?.enabled && twilioSettings.authToken && twilioSettings.fromPhoneNumber) {
                await sendBookingNotification(booking, twilioSettings);
            }
        } catch (error) {
            console.error("Twilio Notification Error:", error);
            // Don't fail the request, just log error
        }

        res.status(201).json(booking);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/:id', requireAdmin, async (req, res) => {
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
});

router.put('/:id/status', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ message: "Status is required" });

        const booking = await storage.updateBookingStatus(Number(req.params.id), status);
        res.json(booking);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
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
