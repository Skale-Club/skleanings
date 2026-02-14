
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit = 8, windowMs = 60_000): boolean {
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return false;
    }
    entry.count += 1;
    return entry.count > limit;
}

const conversationBookingCounts = new Map<string, { count: number; lastBookingAt: number }>();
const MAX_BOOKINGS_PER_CONVERSATION = 3;
const BOOKING_COUNT_RESET_MS = 3600000; // 1 hour

export function canCreateBooking(conversationId: string): boolean {
    const now = Date.now();
    const record = conversationBookingCounts.get(conversationId);

    if (!record || now - record.lastBookingAt > BOOKING_COUNT_RESET_MS) {
        return true;
    }

    return record.count < MAX_BOOKINGS_PER_CONVERSATION;
}

export function recordBookingCreation(conversationId: string): void {
    const now = Date.now();
    const record = conversationBookingCounts.get(conversationId);

    if (!record || now - record.lastBookingAt > BOOKING_COUNT_RESET_MS) {
        conversationBookingCounts.set(conversationId, { count: 1, lastBookingAt: now });
    } else {
        conversationBookingCounts.set(conversationId, { count: record.count + 1, lastBookingAt: now });
    }
}
