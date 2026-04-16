import { db } from "../db";
import {
  bookings, bookingItems,
  type Booking, type BookingItem, type InsertBooking,
} from "@shared/schema";
import { eq, and, gte, lte, asc, desc } from "drizzle-orm";
import { getService } from "./catalog";

export async function createBooking(
  booking: InsertBooking & {
    totalPrice: string;
    totalDurationMinutes: number;
    endTime: string;
    bookingItemsData?: any[];
  },
): Promise<Booking> {
  return await db.transaction(async (tx) => {
    const [newBooking] = await tx.insert(bookings).values({
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      customerAddress: booking.customerAddress,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalDurationMinutes: booking.totalDurationMinutes,
      totalPrice: booking.totalPrice,
      paymentMethod: booking.paymentMethod,
      status: 'pending',
    }).returning();

    if (booking.bookingItemsData && booking.bookingItemsData.length > 0) {
      for (const item of booking.bookingItemsData) {
        await tx.insert(bookingItems).values({
          bookingId: newBooking.id,
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          price: item.price,
          quantity: item.quantity || 1,
          pricingType: item.pricingType || 'fixed_item',
          areaSize: item.areaSize,
          areaValue: item.areaValue,
          selectedOptions: item.selectedOptions,
          selectedFrequency: item.selectedFrequency,
          customerNotes: item.customerNotes,
          priceBreakdown: item.priceBreakdown,
        });
      }
    } else if (booking.serviceIds && booking.serviceIds.length > 0) {
      // Legacy format
      for (const serviceId of booking.serviceIds) {
        const service = await getService(serviceId);
        if (service) {
          await tx.insert(bookingItems).values({
            bookingId: newBooking.id,
            serviceId: service.id,
            serviceName: service.name,
            price: service.price,
            quantity: 1,
            pricingType: service.pricingType || 'fixed_item',
          });
        }
      }
    }

    return newBooking;
  });
}

export async function getBookings(limit: number = 50): Promise<Booking[]> {
  return await db.select().from(bookings).orderBy(desc(bookings.bookingDate)).limit(limit);
}

export async function getBookingsByDate(date: string): Promise<Booking[]> {
  return await db.select().from(bookings).where(eq(bookings.bookingDate, date));
}

export async function getBookingsByDateAndStaff(date: string, staffMemberId: number): Promise<Booking[]> {
  return await db.select().from(bookings).where(
    and(eq(bookings.bookingDate, date), eq(bookings.staffMemberId, staffMemberId))
  );
}

export async function getBookingsByDateRange(from: string, to: string): Promise<Booking[]> {
  return await db.select().from(bookings)
    .where(and(gte(bookings.bookingDate, from), lte(bookings.bookingDate, to)))
    .orderBy(asc(bookings.bookingDate), asc(bookings.startTime));
}

export async function getBooking(id: number): Promise<Booking | undefined> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
  return booking;
}

export async function getBookingByStripeSessionId(sessionId: string): Promise<Booking | undefined> {
  const [booking] = await db.select().from(bookings)
    .where(eq(bookings.stripeSessionId, sessionId)).limit(1);
  return booking;
}

export async function updateBookingStripeFields(
  bookingId: number,
  stripeSessionId: string,
  stripePaymentStatus?: string,
): Promise<void> {
  await db.update(bookings).set({
    stripeSessionId,
    ...(stripePaymentStatus ? { stripePaymentStatus } : {}),
  }).where(eq(bookings.id, bookingId));
}

export async function updateBooking(
  id: number,
  updates: Partial<{
    customerName: string;
    customerEmail: string | null;
    customerPhone: string;
    customerAddress: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    status: string;
    paymentStatus: string;
    totalPrice: string;
  }> & {
    bookingItems?: Array<{
      serviceId: number;
      serviceName: string;
      price: string;
      quantity?: number;
    }>;
  },
): Promise<Booking> {
  return await db.transaction(async (tx) => {
    const { bookingItems: items, ...bookingUpdates } = updates;
    let updated: Booking | undefined;

    if (Object.keys(bookingUpdates).length > 0) {
      [updated] = await tx.update(bookings).set(bookingUpdates).where(eq(bookings.id, id)).returning();
    }

    if (items) {
      await tx.delete(bookingItems).where(eq(bookingItems.bookingId, id));
      for (const item of items) {
        await tx.insert(bookingItems).values({
          bookingId: id,
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          price: item.price,
          quantity: item.quantity ?? 1,
          pricingType: 'fixed_item',
        });
      }
    }

    if (!updated) {
      const [existing] = await tx.select().from(bookings).where(eq(bookings.id, id));
      return existing;
    }
    return updated;
  });
}

export async function deleteBooking(id: number): Promise<void> {
  await db.delete(bookingItems).where(eq(bookingItems.bookingId, id));
  await db.delete(bookings).where(eq(bookings.id, id));
}

export async function updateBookingStatus(id: number, status: string): Promise<Booking> {
  const [updated] = await db.update(bookings).set({ status }).where(eq(bookings.id, id)).returning();
  return updated;
}

export async function getBookingItems(bookingId: number): Promise<BookingItem[]> {
  return await db.select().from(bookingItems).where(eq(bookingItems.bookingId, bookingId));
}

export async function updateBookingGHLSync(
  bookingId: number,
  ghlContactId: string,
  ghlAppointmentId: string,
  syncStatus: string,
): Promise<void> {
  await db.update(bookings)
    .set({ ghlContactId, ghlAppointmentId, ghlSyncStatus: syncStatus })
    .where(eq(bookings.id, bookingId));
}

export async function getBookingsPendingSync(): Promise<Booking[]> {
  return await db.select().from(bookings)
    .where(eq(bookings.ghlSyncStatus, 'pending'))
    .orderBy(asc(bookings.createdAt));
}

export async function updateBookingSyncStatus(
  bookingId: number,
  status: string,
  ghlContactId?: string,
  ghlAppointmentId?: string,
): Promise<void> {
  const updates: any = { ghlSyncStatus: status };
  if (ghlContactId) updates.ghlContactId = ghlContactId;
  if (ghlAppointmentId) updates.ghlAppointmentId = ghlAppointmentId;
  await db.update(bookings).set(updates).where(eq(bookings.id, bookingId));
}

export async function updateBookingContactId(bookingId: number, contactId: number): Promise<void> {
  await db.update(bookings).set({ contactId }).where(eq(bookings.id, bookingId));
}
