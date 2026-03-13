/**
 * create_booking tool
 *
 * Create a booking after the customer has explicitly confirmed the summary.
 * This preserves the existing server-side validation, locking, and sync flow.
 */

import type { ChatErrorCode } from '../../../lib/chat-errors';
import { getAvailabilityForDate } from '../../../lib/availability';
import { syncBookingToGhl } from '../../../lib/booking-ghl-sync';
import { canCreateBooking, recordBookingCreation } from '../../../lib/rate-limit';
import { acquireTimeSlotLock, releaseTimeSlotLock } from '../../../lib/time-slot-lock';
import { CHAT_TOOL } from '../constants';
import { chatDeps } from '../dependencies';
import { calculateCartItemPrice, getErrorMessage } from '../utils';
import { addInternalConversationMessage } from './shared';
import type { ToolHandler } from './registry';
import { type CreateBookingInput } from './schemas';

function bookingFailure(
    errorCode: ChatErrorCode,
    error: string,
    extras: Record<string, unknown> = {}
) {
    return {
        success: false as const,
        error,
        errorCode,
        ...extras,
    };
}

export const createBookingHandler: ToolHandler<CreateBookingInput> = async (
    args,
    conversationId,
    options
) => {
    const language = options?.language || 'en';
    const correlationId = `book_${Date.now()}_${conversationId?.slice(0, 8) || 'unknown'}`;

    let rawServiceItems = Array.isArray(args?.service_items) ? args.service_items : [];
    let serviceIds = Array.isArray(args?.service_ids) ? args.service_ids.map((id: any) => Number(id)).filter(Boolean) : [];
    let cartItemsFromMemory: Array<{ serviceId: number; quantity?: number; serviceName?: string }> = [];
    let conversationForCart: any | null = null;

    if (conversationId) {
        conversationForCart = await chatDeps.storage.getConversation(conversationId);
        const memory = (conversationForCart?.memory as any) || {};
        const cart = memory.cart || [];
        if (cart.length > 0) {
            cartItemsFromMemory = cart.map((item: any) => ({
                serviceId: Number(item.serviceId),
                quantity: Number(item.quantity) || 1,
                serviceName: item.serviceName,
            }));
        }
    }

    const cartServiceIds: number[] = cartItemsFromMemory.map((item) => Number(item.serviceId)).filter(Boolean);
    const providedItemIds: number[] = rawServiceItems
        .map((item: any) => Number(item?.service_id))
        .filter(Boolean);
    const providedIds: number[] = providedItemIds.length > 0 ? providedItemIds : serviceIds;

    if (cartServiceIds.length > 0) {
        const mismatch =
            providedIds.length === 0 ||
            providedIds.some((id) => !cartServiceIds.includes(id)) ||
            cartServiceIds.some((id) => !providedIds.includes(id));

        if (mismatch) {
            serviceIds = [...cartServiceIds];
            rawServiceItems = [];
            console.log(`[create_booking:${correlationId}] Using cart service IDs due to mismatch:`, {
                providedIds,
                cartServiceIds,
            });
        }
    }

    if (serviceIds.length === 0 && rawServiceItems.length === 0 && cartItemsFromMemory.length > 0) {
        serviceIds = cartItemsFromMemory.map((item) => Number(item.serviceId)).filter(Boolean);
    }

    const bookingDate = args?.booking_date as string;
    const startTime = args?.start_time as string;
    const paymentMethod = (args?.payment_method as string) || 'site';
    const customerName = (args?.customer_name as string)?.trim();
    const customerEmail = (args?.customer_email as string)?.trim();
    const customerPhone = (args?.customer_phone as string)?.trim();
    const customerAddress = (args?.customer_address as string)?.trim();
    const notes = (args?.notes as string | undefined)?.trim();

    type NormalizedBookingItem = {
        serviceId: number;
        quantity: number;
        areaSize?: string;
        areaValue?: number;
        selectedOptions?: Array<{ optionId: number; quantity: number }>;
        selectedFrequencyId?: number;
        customerNotes?: string;
    };

    const normalizedItems: NormalizedBookingItem[] = rawServiceItems.length > 0
        ? rawServiceItems
            .map((item: any) => ({
                serviceId: Number(item?.service_id),
                quantity: Number(item?.quantity) || 1,
                areaSize: (item?.area_size as string | undefined)?.trim(),
                areaValue: typeof item?.area_value === 'number' ? item.area_value : undefined,
                selectedOptions: Array.isArray(item?.selected_options)
                    ? item.selected_options
                        .map((opt: any) => ({
                            optionId: Number(opt?.option_id),
                            quantity: Number(opt?.quantity) || 1,
                        }))
                        .filter((opt: any) => opt.optionId)
                    : undefined,
                selectedFrequencyId: typeof item?.selected_frequency_id === 'number' ? item.selected_frequency_id : undefined,
                customerNotes: (item?.customer_notes as string | undefined)?.trim(),
            }))
            .filter((item: any) => item.serviceId)
        : serviceIds.map((id: number) => {
            const cartItem = cartItemsFromMemory.find((item) => item.serviceId === id);
            return {
                serviceId: id,
                quantity: cartItem?.quantity || 1,
                customerNotes: notes,
            };
        });
    const resolvedServiceIds = normalizedItems.map((item: any) => item.serviceId);

    if (conversationId && !canCreateBooking(conversationId)) {
        return bookingFailure(
            'rate_limit:chat',
            'Booking limit reached for this conversation.',
            {
                userMessage: getErrorMessage('bookingLimitReached', language),
            }
        );
    }

    if (
        normalizedItems.length === 0 ||
        !bookingDate ||
        !startTime ||
        !customerName ||
        !customerPhone ||
        !customerAddress
    ) {
        const error = 'Missing required booking fields.';
        if (conversationId) {
            await addInternalConversationMessage(
                conversationId,
                `[create_booking:${correlationId}] Failed: Missing required fields`,
                {
                    type: 'booking_error',
                    severity: 'error',
                    step: 'validation',
                    error: { message: error }
                }
            );
        }
        return bookingFailure('booking:missing_fields', error, {
            userMessage: getErrorMessage('systemUnavailable', language),
        });
    }

    const services = [];
    const bookingItemsData: any[] = [];
    let totalPrice = 0;
    let totalDuration = 0;

    for (const item of normalizedItems) {
        const service = await chatDeps.storage.getService(item.serviceId);
        if (!service) {
            return bookingFailure(
                'service:not_found',
                `Service ID ${item.serviceId} not found`,
                {
                    userMessage: getErrorMessage('systemUnavailable', language),
                }
            );
        }

        const pricingType = service.pricingType || 'fixed_item';
        if (pricingType === 'area_based') {
            const hasCustomArea = typeof item.areaValue === 'number' && item.areaValue > 0;
            const hasPreset = !!item.areaSize && item.areaSize !== 'custom';
            if (!hasCustomArea && !hasPreset) {
                return bookingFailure(
                    'bad_request:tool',
                    'Missing area size for area-based service.',
                    {
                        userMessage: 'Please share the size or square footage so I can price this correctly.',
                    }
                );
            }
            if (item.areaSize === 'custom' && !hasCustomArea) {
                return bookingFailure(
                    'bad_request:tool',
                    'Missing square footage for custom area size.',
                    {
                        userMessage: 'Please share the square footage so I can price this correctly.',
                    }
                );
            }
        }

        if (pricingType === 'custom_quote' && !item.customerNotes && notes) {
            item.customerNotes = notes;
        }

        const serviceOptions = await chatDeps.storage.getServiceOptions(service.id);
        const frequencies = await chatDeps.storage.getServiceFrequencies(service.id);
        const calculated = await calculateCartItemPrice(service, item, serviceOptions, frequencies);

        services.push(service);
        totalPrice += calculated.price;
        totalDuration += service.durationMinutes * (item.quantity || 1);

        bookingItemsData.push({
            serviceId: service.id,
            serviceName: service.name,
            price: calculated.price.toFixed(2),
            quantity: item.quantity || 1,
            pricingType,
            areaSize: calculated.areaSize,
            areaValue: calculated.areaValue?.toString(),
            selectedOptions: calculated.selectedOptions,
            selectedFrequency: calculated.selectedFrequency,
            customerNotes: item.customerNotes,
            priceBreakdown: calculated.breakdown,
        });
    }

    const startDate = new Date(`2000-01-01T${startTime}:00`);
    startDate.setMinutes(startDate.getMinutes() + totalDuration);
    const endHour = startDate.getHours().toString().padStart(2, '0');
    const endMinute = startDate.getMinutes().toString().padStart(2, '0');
    const endTime = `${endHour}:${endMinute}`;

    if (conversationId && !(await acquireTimeSlotLock(bookingDate, startTime, conversationId))) {
        console.log(`[create_booking:${correlationId}] Time slot is locked by another booking:`, { bookingDate, startTime });
        return bookingFailure(
            'booking:slot_taken',
            'This time slot is being booked by another customer. Please select a different time.',
            {
                userMessage: getErrorMessage('availabilityCheckFailed', language),
            }
        );
    }

    try {
        const existingBookings = await chatDeps.storage.getBookingsByDate(bookingDate);
        const hasConflict = existingBookings.some((booking) => startTime < booking.endTime && endTime > booking.startTime);
        if (hasConflict) {
            if (conversationId) {
                await releaseTimeSlotLock(bookingDate, startTime, conversationId);
            }
            return bookingFailure(
                'booking:slot_unavailable',
                'Time slot is no longer available.',
                {
                    userMessage: getErrorMessage('availabilityCheckFailed', language),
                }
            );
        }

        const ghlSettings = await chatDeps.storage.getIntegrationSettings('gohighlevel');
        const useGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId);

        const company = await chatDeps.storage.getCompanySettings();
        const timeZone = company?.timeZone || 'America/New_York';

        let slotsForDay: string[] = [];

        try {
            slotsForDay = await getAvailabilityForDate(
                bookingDate,
                totalDuration,
                useGhl,
                ghlSettings,
                { requireGhl: useGhl, timeZone }
            );
        } catch (error: any) {
            const errorMsg = error?.message || 'Failed to verify availability in GoHighLevel.';
            if (conversationId) {
                await releaseTimeSlotLock(bookingDate, startTime, conversationId);
                await addInternalConversationMessage(
                    conversationId,
                    `[create_booking:${correlationId}] Failed: Availability check error`,
                    {
                        type: 'booking_error',
                        severity: 'error',
                        step: 'availability',
                        error: { message: errorMsg, details: error }
                    }
                );
            }
            return bookingFailure('provider:unavailable', errorMsg, {
                userMessage: getErrorMessage('availabilityCheckFailed', language)
            });
        }

        if (slotsForDay.length > 0 && !slotsForDay.includes(startTime)) {
            if (conversationId) {
                await releaseTimeSlotLock(bookingDate, startTime, conversationId);
                await addInternalConversationMessage(
                    conversationId,
                    `[create_booking:${correlationId}] Failed: Time slot ${startTime} not available`,
                    {
                        type: 'booking_error',
                        severity: 'warning',
                        step: 'availability',
                        error: { message: 'Selected time unavailable', availableSlots: slotsForDay }
                    }
                );
            }
            return bookingFailure(
                'booking:slot_unavailable',
                'Selected time is unavailable. Choose another slot.',
                {
                    userMessage: getErrorMessage('availabilityCheckFailed', language),
                    availableSlots: slotsForDay
                }
            );
        }

        const minimumBookingValue = parseFloat(company?.minimumBookingValue as any) || 0;
        let minimumAdjustmentNote = '';
        if (minimumBookingValue > 0 && totalPrice < minimumBookingValue) {
            minimumAdjustmentNote = getErrorMessage('minimumAdjustment', language, { minimum: minimumBookingValue.toFixed(2) });
            totalPrice = minimumBookingValue;
        }

        const booking = await chatDeps.storage.createBooking({
            serviceIds: resolvedServiceIds,
            bookingDate,
            startTime,
            endTime,
            totalDurationMinutes: totalDuration,
            totalPrice: totalPrice.toFixed(2),
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            paymentMethod,
            bookingItemsData,
        });

        const serviceNamesForNotification = services
            .map((service) => service.name?.trim())
            .filter((name): name is string => Boolean(name));
        const serviceNames = serviceNamesForNotification.join(', ');
        const ghlSync = await syncBookingToGhl(booking, serviceNames);
        const pendingSync = ghlSync.attempted && !ghlSync.synced;

        try {
            const [twilioSettings, telegramSettings] = await Promise.all([
                chatDeps.storage.getTwilioSettings(),
                chatDeps.storage.getTelegramSettings(),
            ]);

            if (twilioSettings?.enabled && twilioSettings.authToken && twilioSettings.fromPhoneNumber) {
                try {
                    await chatDeps.twilio.sendBookingNotification(
                        booking,
                        serviceNamesForNotification,
                        twilioSettings,
                        company?.companyName || 'the business'
                    );
                } catch (twilioError) {
                    console.error('[create_booking] Twilio Notification Error:', twilioError);
                }
            }

            if (telegramSettings?.enabled && telegramSettings.botToken && telegramSettings.chatIds.length > 0) {
                try {
                    await chatDeps.telegram.sendBookingNotification(
                        booking,
                        serviceNamesForNotification,
                        telegramSettings,
                        company?.companyName || 'the business'
                    );
                } catch (telegramError) {
                    console.error('[create_booking] Telegram Notification Error:', telegramError);
                }
            }
        } catch (notificationError) {
            console.error('[create_booking] Booking Notification Error:', notificationError);
        }

        if (conversationId) {
            await chatDeps.storage.updateConversation(conversationId, {
                visitorName: customerName,
                visitorEmail: customerEmail,
                visitorPhone: customerPhone,
            });

            const ghlSyncLabel = ghlSync.synced
                ? `Contact ${ghlSync.contactId} | Appointment ${ghlSync.appointmentId}`
                : (ghlSync.attempted ? 'GHL sync failed' : 'GHL sync skipped');
            await addInternalConversationMessage(
                conversationId,
                `[SUCCESS] Booking created: ${bookingDate} ${startTime}-${endTime} | ${services.map((service) => service.name).join(', ')} | $${totalPrice.toFixed(2)} | ${ghlSyncLabel}`,
                {
                    type: 'ghl_booking',
                    step: 'success',
                    ghlContactId: ghlSync.contactId,
                    ghlAppointmentId: ghlSync.appointmentId,
                    ghlSyncAttempted: ghlSync.attempted,
                    ghlSynced: ghlSync.synced,
                    bookingDate,
                    startTime,
                    endTime,
                    totalPrice: totalPrice.toFixed(2),
                    services: services.map((service) => ({ id: service.id, name: service.name })),
                    customerName,
                    customerEmail,
                    customerPhone,
                    customerAddress,
                }
            );

            if (pendingSync) {
                await addInternalConversationMessage(
                    conversationId,
                    `[WARNING] Booking created locally but GHL sync failed: ${ghlSync.reason || 'Unknown error'}`,
                    {
                        type: 'booking_fallback',
                        severity: 'warning',
                        step: 'ghl_sync',
                        bookingId: booking.id,
                        requiresManualSync: true,
                        ghlContactId: ghlSync.contactId,
                        ghlAppointmentId: ghlSync.appointmentId,
                        error: { message: ghlSync.reason || 'Unknown error' },
                    }
                );
            }

            recordBookingCreation(conversationId);
            await releaseTimeSlotLock(bookingDate, startTime, conversationId);
        }

        if (pendingSync) {
            return {
                success: true,
                bookingId: booking.id,
                bookingDate,
                startTime,
                endTime,
                totalDurationMinutes: totalDuration,
                totalPrice: totalPrice.toFixed(2),
                services: services.map((service) => ({ id: service.id, name: service.name })),
                minimumAdjustmentNote,
                warning: 'Your booking has been saved. You will receive a confirmation shortly.',
                pendingSync: true,
            };
        }

        return {
            success: true,
            bookingId: booking.id,
            bookingDate,
            startTime,
            endTime,
            totalDurationMinutes: totalDuration,
            totalPrice: totalPrice.toFixed(2),
            services: services.map((service) => ({ id: service.id, name: service.name })),
            minimumAdjustmentNote,
            userMessage: 'Booking confirmed!',
        };
    } catch (error: any) {
        console.error('[create_booking] Error:', error);
        if (conversationId) {
            await releaseTimeSlotLock(bookingDate, startTime, conversationId);
        }
        return bookingFailure('booking:creation_failed', 'An unexpected error occurred.', {
            userMessage: getErrorMessage('systemUnavailable', language),
        });
    }
};

export const createBookingTool = {
    name: CHAT_TOOL.CREATE_BOOKING,
    description: 'Create a booking appointment after the customer explicitly confirms the full summary.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            service_ids: {
                type: 'array',
                items: { type: 'number' },
                description: 'IDs of services to book',
            },
            service_items: {
                type: 'array',
                description: 'Detailed service items for non-fixed pricing types',
                items: {
                    type: 'object',
                    properties: {
                        service_id: { type: 'number' },
                        quantity: { type: 'number' },
                        area_size: { type: 'string' },
                        area_value: { type: 'number' },
                        selected_options: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    option_id: { type: 'number' },
                                    quantity: { type: 'number' },
                                },
                                additionalProperties: false,
                            },
                        },
                        selected_frequency_id: { type: 'number' },
                        customer_notes: { type: 'string' },
                    },
                    additionalProperties: false,
                },
            },
            booking_date: {
                type: 'string',
                description: 'Booking date in YYYY-MM-DD',
            },
            start_time: {
                type: 'string',
                description: 'Start time in HH:mm',
            },
            customer_name: { type: 'string', description: 'Customer full name' },
            customer_email: { type: 'string', description: 'Customer email' },
            customer_phone: { type: 'string', description: 'Customer phone' },
            customer_address: { type: 'string', description: 'Customer address' },
            payment_method: {
                type: 'string',
                enum: ['site', 'online'],
                description: 'Payment method; defaults to site',
            },
            notes: { type: 'string', description: 'Additional booking notes' },
        },
        additionalProperties: false,
    },
    handler: createBookingHandler,
    requiresConversationId: true,
};
