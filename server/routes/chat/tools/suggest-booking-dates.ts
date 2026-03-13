/**
 * suggest_booking_dates tool
 * 
 * Get up to 5 suggested available dates for booking.
 * Can check specific date or week if customer requests it.
 */

import { ChatError } from '../../../lib/chat-errors';
import { CHAT_TOOL } from '../constants';
import { chatDeps } from '../dependencies';
import { getAvailabilityRange, getTodayStr } from '../../../lib/availability';
import { formatAvailabilityResponse, pickRandomSlots, getErrorMessage } from '../utils';
import type { ToolHandler } from './registry';
import { type SuggestBookingDatesInput } from './schemas';
import { requireConversation, requireService } from './shared';

/**
 * Handler for suggest_booking_dates tool
 */
export const suggestBookingDatesHandler: ToolHandler<SuggestBookingDatesInput> = async (
    args,
    conversationId,
    options
) => {
    const language = options?.language || 'en';
    let serviceId = Number(args?.service_id);
    const specificDate = args?.specific_date as string | undefined;
    const maxSuggestions = Math.min(Math.max(Number(args?.max_suggestions) || 3, 1), 5); // Default 3, max 5

    let service = serviceId ? await requireService(serviceId) : null;

    // Fallback to cart/memory if no service ID provided
    if ((!serviceId || !service) && conversationId) {
        const conversation = await requireConversation(conversationId);
        const memory = (conversation?.memory as any) || {};
        const cart = Array.isArray(memory.cart) ? memory.cart : [];
        const fallbackServiceId =
            Number(cart?.[0]?.serviceId) ||
            Number(memory?.selectedService?.id) ||
            0;

        if (fallbackServiceId) {
            serviceId = fallbackServiceId;
            service = await requireService(serviceId);
        }
    }

    if (!serviceId) {
        throw new ChatError('bad_request:tool', 'Service ID is required');
    }
    if (!service) {
        throw new ChatError('service:not_found');
    }

    const durationMinutes = service.durationMinutes || 60;
    const company = await chatDeps.storage.getCompanySettings();
    const timeZone = company?.timeZone || 'America/New_York';
    const ghlSettings = await chatDeps.storage.getIntegrationSettings('gohighlevel');
    const useGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId);

    // If specific date is requested, prioritize that range
    let startDateStr = getTodayStr(new Date(), timeZone);
    if (specificDate && /^\d{4}-\d{2}-\d{2}$/.test(specificDate)) {
        startDateStr = specificDate;
    }

    // Check range of dates - 10 days by default, or 5 days around specific date
    const daysToCheck = specificDate ? 5 : 10;
    const today = new Date();
    const start = new Date(startDateStr);
    if (start < today && start.getDate() !== today.getDate()) {
        // Can't book in past, reset to today
        start.setTime(today.getTime());
    }
    const end = new Date(start);
    end.setDate(end.getDate() + daysToCheck);

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    try {
        const availabilityMap = await getAvailabilityRange(
            startDate,
            endDate,
            durationMinutes,
            {
                useGhl,
                ghlSettings,
                requireGhl: useGhl,
                timeZone
            }
        );

        const availability = Object.entries(availabilityMap).map(([date, slots]) => {
            const d = new Date(date + 'T12:00:00');
            const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long', timeZone });
            return { date, dayOfWeek, availableSlots: slots };
        });

        // Filter dates with availability
        const availableDates = availability.filter(d => d.availableSlots && d.availableSlots.length > 0);

        // Map to response format
        const suggestions = availableDates.slice(0, maxSuggestions).map(d => ({
            date: d.date,
            dayOfWeek: d.dayOfWeek,
            availableSlots: pickRandomSlots(d.availableSlots || [], 3)
        }));

        const formattedText = formatAvailabilityResponse(suggestions);

        return {
            success: true,
            suggestions,
            formattedText,
            timeZone,
            calendarProvider: useGhl ? 'gohighlevel' : 'local'
        };
    } catch (error: any) {
        console.error('[suggest_booking_dates] Error:', error);
        return {
            success: false,
            error: 'Failed to check availability',
            message: getErrorMessage('availabilityCheckFailed', language)
        };
    }
};

// Tool definition
export const suggestBookingDatesTool = {
    name: CHAT_TOOL.SUGGEST_BOOKING_DATES,
    description: 'Get up to 3 suggested available dates for booking. Use this to proactively suggest dates to the customer. Can also check specific date or week if customer requests it.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            service_id: {
                type: 'number',
                description: 'ID of the service to determine duration',
            },
            specific_date: {
                type: 'string',
                description: 'Optional specific date to check (YYYY-MM-DD). If provided, will check this date and surrounding dates.',
            },
            max_suggestions: {
                type: 'number',
                description: 'Maximum number of date suggestions to return (default 3, max 5)',
            },
        },
        required: ['service_id'],
        additionalProperties: false,
    },
    handler: suggestBookingDatesHandler,
};
