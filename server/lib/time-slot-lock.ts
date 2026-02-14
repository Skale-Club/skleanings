
import { storage } from "../storage";

// Persistent time slot locks via database (survives server restarts)
const LOCK_TIMEOUT_MS = 30000; // 30 seconds

export async function acquireTimeSlotLock(bookingDate: string, startTime: string, conversationId: string): Promise<boolean> {
    return await storage.acquireTimeSlotLock(bookingDate, startTime, conversationId, LOCK_TIMEOUT_MS);
}

export async function releaseTimeSlotLock(bookingDate: string, startTime: string, conversationId: string): Promise<void> {
    await storage.releaseTimeSlotLock(bookingDate, startTime, conversationId);
}

// Function to initialize cleanup
export function initTimeSlotLockCleanup() {
    setInterval(async () => {
        try {
            const cleaned = await storage.cleanExpiredTimeSlotLocks();
            if (cleaned > 0) {
                console.log(`[Locks] Cleaned ${cleaned} expired time slot locks`);
            }
        } catch (err) {
            console.error('[Locks] Error cleaning expired locks:', err);
        }
    }, 5 * 60 * 1000);
}
