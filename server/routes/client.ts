
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireClient } from "../lib/auth";
import { checkAvailability } from "../lib/availability";
import { syncClientCancelToExternal, syncClientRescheduleToExternal } from "../lib/booking-client-sync";

const router = Router();

const patchMeSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    profileImageUrl: z.string().nullable().optional(),
});

// GET /api/client/me
router.get("/me", requireClient, async (req, res) => {
    try {
        const user = (req as any).user;
        const profile = await storage.getUser(user.id);
        if (!profile) return res.status(404).json({ message: "User not found" });
        res.json(profile);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// PATCH /api/client/me
router.patch("/me", requireClient, async (req, res) => {
    try {
        const user = (req as any).user;
        const validatedData = patchMeSchema.parse(req.body);
        const updated = await storage.updateUser(user.id, validatedData);
        res.json(updated);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: err.errors });
        }
        res.status(500).json({ message: (err as Error).message });
    }
});

// GET /api/client/bookings
router.get("/bookings", requireClient, async (req, res) => {
    try {
        const user = (req as any).user;
        const clientBookings = await storage.getClientBookings(user.id, user.email ?? "");
        res.json(clientBookings);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// GET /api/client/bookings/:id
router.get("/bookings/:id(\\d+)", requireClient, async (req, res) => {
    try {
        const user = (req as any).user;
        const booking = await storage.getBooking(Number(req.params.id));
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        const isOwner =
            booking.userId === user.id ||
            (booking.userId === null && booking.customerEmail === user.email);

        if (!isOwner) return res.status(403).json({ message: "Forbidden" });

        res.json(booking);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

const rescheduleSchema = z.object({
    bookingDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
});

// POST /api/client/bookings/:id/cancel
router.post("/bookings/:id(\\d+)/cancel", requireClient, async (req, res) => {
    try {
        const user = (req as any).user;
        const booking = await storage.getBooking(Number(req.params.id));
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        const isOwner =
            booking.userId === user.id ||
            (booking.userId === null && booking.customerEmail === user.email);
        if (!isOwner) return res.status(403).json({ message: "Forbidden" });

        if (booking.status !== "pending" && booking.status !== "confirmed") {
            return res.status(400).json({ message: "Booking cannot be cancelled" });
        }

        const today = new Date().toISOString().slice(0, 10);
        if (booking.bookingDate <= today) {
            return res.status(400).json({ message: "Cannot cancel past or same-day bookings" });
        }

        await storage.updateBookingStatus(booking.id, "cancelled");
        res.json({ success: true });
        syncClientCancelToExternal(booking).catch(err =>
            console.error("[ClientSync] Unhandled cancel sync error:", err)
        );
        return;
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// POST /api/client/bookings/:id/reschedule
router.post("/bookings/:id(\\d+)/reschedule", requireClient, async (req, res) => {
    try {
        const validatedData = rescheduleSchema.parse(req.body);
        const user = (req as any).user;
        const booking = await storage.getBooking(Number(req.params.id));
        if (!booking) return res.status(404).json({ message: "Booking not found" });

        const isOwner =
            booking.userId === user.id ||
            (booking.userId === null && booking.customerEmail === user.email);
        if (!isOwner) return res.status(403).json({ message: "Forbidden" });

        if (booking.status !== "pending" && booking.status !== "confirmed") {
            return res.status(400).json({ message: "Booking cannot be rescheduled" });
        }

        const today = new Date().toISOString().slice(0, 10);
        if (validatedData.bookingDate <= today) {
            return res.status(400).json({ message: "New booking date must be in the future" });
        }

        const available = await checkAvailability(
            validatedData.bookingDate,
            validatedData.startTime,
            validatedData.endTime,
            booking.id
        );
        if (!available) {
            return res.status(409).json({ message: "Requested time slot is not available" });
        }

        const updated = await storage.updateBooking(booking.id, {
            bookingDate: validatedData.bookingDate,
            startTime: validatedData.startTime,
            endTime: validatedData.endTime,
        });
        res.json(updated);
        syncClientRescheduleToExternal(booking, validatedData.bookingDate, validatedData.startTime, validatedData.endTime).catch(err =>
            console.error("[ClientSync] Unhandled reschedule sync error:", err)
        );
        return;
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: err.errors });
        }
        res.status(500).json({ message: (err as Error).message });
    }
});

export default router;
