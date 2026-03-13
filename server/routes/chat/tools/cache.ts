/**
 * Chat Tool Caching Utilities
 * 
 * Provides caching for frequently accessed data (services, FAQs)
 * with TTL-based invalidation
 */

import { chatDeps } from '../dependencies';

// Cache configuration
const CACHE_TTL_MS = {
    services: 5 * 60 * 1000, // 5 minutes
    faqs: 5 * 60 * 1000, // 5 minutes
};

// Simple TTL cache for frequently queried data in chat tools
const chatCache = {
    services: { data: null as any[] | null, expiry: 0 },
    faqs: { data: null as any[] | null, expiry: 0 },
};

/**
 * Get cached services with TTL
 */
export async function getCachedServices(): Promise<any[]> {
    const now = Date.now();
    if (chatCache.services.data && now < chatCache.services.expiry) {
        return chatCache.services.data;
    }
    const services = await chatDeps.storage.getServices(undefined, undefined, false);
    chatCache.services = { data: services, expiry: Date.now() + CACHE_TTL_MS.services };
    return services;
}

/**
 * Get cached FAQs with TTL
 */
export async function getCachedFaqs(): Promise<any[]> {
    const now = Date.now();
    if (chatCache.faqs.data && now < chatCache.faqs.expiry) {
        return chatCache.faqs.data;
    }
    const faqs = await chatDeps.storage.getFaqs();
    chatCache.faqs = { data: faqs, expiry: Date.now() + CACHE_TTL_MS.faqs };
    return faqs;
}

/**
 * Invalidate chat cache
 * @param type - Type of cache to invalidate ('services', 'faqs', or undefined for all)
 */
export function invalidateChatCache(type?: 'services' | 'faqs'): void {
    if (!type || type === 'services') {
        chatCache.services = { data: null, expiry: 0 };
    }
    if (!type || type === 'faqs') {
        chatCache.faqs = { data: null, expiry: 0 };
    }
}
