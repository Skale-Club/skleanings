import { db } from "../db";
import { timeSlotLocks } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function acquireTimeSlotLock(
  bookingDate: string,
  startTime: string,
  conversationId: string,
  ttlMs: number = 30000,
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  // Clean expired locks for this slot
  await db.delete(timeSlotLocks).where(
    and(
      eq(timeSlotLocks.bookingDate, bookingDate),
      eq(timeSlotLocks.startTime, startTime),
      lte(timeSlotLocks.expiresAt, now)
    )
  );

  // Check for active lock by another conversation
  const [existingLock] = await db.select().from(timeSlotLocks).where(
    and(
      eq(timeSlotLocks.bookingDate, bookingDate),
      eq(timeSlotLocks.startTime, startTime),
      gte(timeSlotLocks.expiresAt, now)
    )
  );

  if (existingLock) {
    if (existingLock.conversationId === conversationId) {
      await db.update(timeSlotLocks)
        .set({ expiresAt, lockedAt: now })
        .where(eq(timeSlotLocks.id, existingLock.id));
      return true;
    }
    return false;
  }

  try {
    await db.insert(timeSlotLocks).values({ bookingDate, startTime, conversationId, expiresAt });
    return true;
  } catch (error: any) {
    if (error.code === '23505') return false;
    throw error;
  }
}

export async function releaseTimeSlotLock(
  bookingDate: string,
  startTime: string,
  conversationId: string,
): Promise<void> {
  await db.delete(timeSlotLocks).where(
    and(
      eq(timeSlotLocks.bookingDate, bookingDate),
      eq(timeSlotLocks.startTime, startTime),
      eq(timeSlotLocks.conversationId, conversationId)
    )
  );
}

export async function cleanExpiredTimeSlotLocks(): Promise<number> {
  const now = new Date();
  const result = await db.delete(timeSlotLocks).where(lte(timeSlotLocks.expiresAt, now)).returning();
  return result.length;
}
