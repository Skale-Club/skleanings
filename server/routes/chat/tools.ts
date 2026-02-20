
import { OpenAI } from "openai";
import {
    type IntakeObjective,
    formatAvailabilityResponse,
    formatBusinessHoursSummary,
    formatDateLabel,
    formatTimeLabel,
    getErrorMessage,
    normalizeServiceName,
    calculateCartItemPrice,
    pickRandomSlots
} from "./utils";
import { getAvailabilityForDate, getAvailabilityRange, getTodayStr } from "../../lib/availability";
import { acquireTimeSlotLock, releaseTimeSlotLock } from "../../lib/time-slot-lock";
import { canCreateBooking, recordBookingCreation } from "../../lib/rate-limit";
import { syncBookingToGhl } from "../../lib/booking-ghl-sync";
import crypto from "crypto";
import { CHAT_TOOL, CACHE_TTL, MESSAGE_ROLE } from "./constants";
import { chatDeps } from "./dependencies";

// Simple TTL cache for frequently queried data in chat tools
const chatCache = {
    services: { data: null as any[] | null, expiry: 0 },
    faqs: { data: null as any[] | null, expiry: 0 },
};
const CACHE_TTL_MS = CACHE_TTL.SERVICES; // Use constant from constants.ts

export async function getCachedServices(): Promise<any[]> {
    if (chatCache.services.data && Date.now() < chatCache.services.expiry) {
        return chatCache.services.data;
    }
    const services = await chatDeps.storage.getServices(undefined, undefined, false);
    chatCache.services = { data: services, expiry: Date.now() + CACHE_TTL_MS };
    return services;
}

export async function getCachedFaqs(): Promise<any[]> {
    if (chatCache.faqs.data && Date.now() < chatCache.faqs.expiry) {
        return chatCache.faqs.data;
    }
    const faqs = await chatDeps.storage.getFaqs();
    chatCache.faqs = { data: faqs, expiry: Date.now() + CACHE_TTL_MS };
    return faqs;
}

export function invalidateChatCache(type?: 'services' | 'faqs') {
    if (!type || type === 'services') chatCache.services = { data: null, expiry: 0 };
    if (!type || type === 'faqs') chatCache.faqs = { data: null, expiry: 0 };
}

// Helper to add internal messages
export async function addInternalConversationMessage(
    conversationId: string,
    content: string,
    metadata: Record<string, any> = {}
) {
    await chatDeps.storage.addConversationMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: MESSAGE_ROLE.ASSISTANT,
        content,
        metadata: { ...metadata, internal: true },
    });
}

function formatServiceForTool(service: any) {
    return {
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price?.toString?.() || service.price,
    };
}

// Build chat tools dynamically based on intake flow configuration
export function buildChatTools(enabledObjectives: IntakeObjective[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    // Determine which fields are required based on intake flow
    const enabledIds = new Set(enabledObjectives.map(o => o.id));

    // Map intake objective IDs to create_booking field names
    const bookingRequiredFields: string[] = ['service_ids', 'booking_date', 'start_time'];
    if (enabledIds.has('name')) bookingRequiredFields.push('customer_name');
    if (enabledIds.has('phone')) bookingRequiredFields.push('customer_phone');
    if (enabledIds.has('address')) bookingRequiredFields.push('customer_address');
    // Note: email is only required if explicitly in intake flow (not by default)

    return [
        {
            type: "function",
            function: {
                name: CHAT_TOOL.LIST_SERVICES,
                description: "List all available cleaning services from our catalog. CRITICAL: You must ONLY recommend services that exist in this list. Never combine multiple smaller services when a single larger service exists. For example, if customer needs a 7-seater cleaned, recommend the 7-8 Seater service, NOT multiple 3-seater sessions.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Search by size/type (e.g. '7 seater', 'sectional', 'large', 'loveseat'). The system uses smart matching to find relevant services." },
                    },
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: CHAT_TOOL.GET_SERVICE_DETAILS,
                description: "Get details for a specific service",
                parameters: {
                    type: "object",
                    properties: {
                        service_id: { type: "number", description: "ID of the service" },
                    },
                    required: ["service_id"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: CHAT_TOOL.SUGGEST_BOOKING_DATES,
                description: "Get up to 3 suggested available dates for booking. Use this to proactively suggest dates to the customer. Can also check specific date or week if customer requests it.",
                parameters: {
                    type: "object",
                    properties: {
                        service_id: { type: "number", description: "ID of the service to determine duration" },
                        specific_date: {
                            type: "string",
                            description: "Optional specific date to check (YYYY-MM-DD). If provided, will check this date and surrounding dates."
                        },
                        max_suggestions: {
                            type: "number",
                            description: "Maximum number of date suggestions to return (default 3, max 5)"
                        },
                    },
                    required: ["service_id"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: CHAT_TOOL.CREATE_BOOKING,
                description: "Create a booking for one or more services once the customer has provided all required details and confirmed",
                parameters: {
                    type: "object",
                    properties: {
                        service_items: {
                            type: "array",
                            description: "Optional detailed service items for non-fixed pricing types",
                            items: {
                                type: "object",
                                properties: {
                                    service_id: { type: "number" },
                                    quantity: { type: "number" },
                                    area_size: { type: "string" },
                                    area_value: { type: "number" },
                                    selected_options: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                option_id: { type: "number" },
                                                quantity: { type: "number" },
                                            },
                                            required: ["option_id", "quantity"],
                                            additionalProperties: false,
                                        },
                                    },
                                    selected_frequency_id: { type: "number" },
                                    customer_notes: { type: "string" },
                                },
                                required: ["service_id"],
                                additionalProperties: false,
                            },
                        },
                        service_ids: {
                            type: "array",
                            items: { type: "number" },
                            description: "IDs of services to book",
                        },
                        booking_date: { type: "string", description: "Booking date in YYYY-MM-DD (business timezone)" },
                        start_time: { type: "string", description: "Start time in HH:mm (24h, business timezone)" },
                        customer_name: { type: "string", description: "Customer full name" },
                        customer_email: { type: "string", description: "Customer email (only if provided)" },
                        customer_phone: { type: "string", description: "Customer phone" },
                        customer_address: { type: "string", description: "Full address with street, city, state, and unit if applicable" },
                        payment_method: {
                            type: "string",
                            enum: ["site", "online"],
                            description: "Payment method; defaults to site",
                        },
                        notes: { type: "string", description: "Any additional notes from the customer", nullable: true },
                    },
                    required: bookingRequiredFields,
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: CHAT_TOOL.UPDATE_CONTACT,
                description: "Save visitor contact info (name/email/phone) to the conversation as soon as it is provided",
                parameters: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Visitor name" },
                        email: { type: "string", description: "Visitor email" },
                        phone: { type: "string", description: "Visitor phone" },
                    },
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: CHAT_TOOL.UPDATE_MEMORY,
                description: "Update the conversation memory with collected information. Call this after collecting each piece of information to track progress. IMPORTANT: Use add_service to add services to the cart instead of selected_service.",
                parameters: {
                    type: "object",
                    properties: {
                        selected_service: {
                            type: "object",
                            description: "DEPRECATED: Use add_service tool instead",
                            properties: {
                                id: { type: "number" },
                                name: { type: "string" },
                                price: { type: "string" },
                            },
                        },
                        zipcode: { type: "string", description: "Customer's ZIP code" },
                        service_type: { type: "string", description: "Type of service selected (e.g., '3-seater sofa cleaning')" },
                        service_details: { type: "string", description: "Service details (size, material, notes)" },
                        preferred_date: { type: "string", description: "Customer's preferred date" },
                        selected_date: { type: "string", description: "Confirmed booking date (YYYY-MM-DD)" },
                        selected_time: { type: "string", description: "Confirmed booking time (HH:mm)" },
                        name: { type: "string", description: "Customer name" },
                        phone: { type: "string", description: "Customer phone" },
                        email: { type: "string", description: "Customer email" },
                        address: { type: "string", description: "Customer full address" },
                        current_step: { type: "string", description: "Current step in the intake flow" },
                        completed_step: { type: "string", description: "Step that was just completed" },
                    },
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: CHAT_TOOL.ADD_SERVICE,
                description: "Add a service to the customer's cart. Call this IMMEDIATELY after customer confirms each service. This tracks all services for the final booking.",
                parameters: {
                    type: "object",
                    properties: {
                        service_id: { type: "number", description: "ID of the service from list_services" },
                        service_name: { type: "string", description: "Name of the service" },
                        price: { type: "number", description: "Price of the service" },
                        quantity: { type: "number", description: "Quantity of the service (default 1)" },
                    },
                    required: ["service_id", "service_name", "price"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: CHAT_TOOL.VIEW_CART,
                description: "Get current services in the customer's cart with total price",
                parameters: {
                    type: "object",
                    properties: {},
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: CHAT_TOOL.GET_BUSINESS_POLICIES,
                description: "Get business hours and any minimum booking rules",
                parameters: {
                    type: "object",
                    properties: {},
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: CHAT_TOOL.SEARCH_FAQS,
                description: "Search frequently asked questions database to answer questions about policies, cleaning process, products, guarantees, cancellation, and other common inquiries",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Optional search keywords to filter FAQs (e.g., 'cancellation', 'products', 'guarantee'). Leave empty to get all FAQs."
                        },
                    },
                    additionalProperties: false,
                },
            },
        },
    ];
}

export async function runChatTool(
    toolName: string,
    args: any,
    conversationId?: string,
    options?: { allowFaqs?: boolean; allowKnowledgeBase?: boolean; language?: string; userMessage?: string; userMessageId?: string }
) {
    const language = options?.language || 'en';
    switch (toolName) {
        case CHAT_TOOL.LIST_SERVICES: {
            const services = await getCachedServices();
            const query = (args?.query as string | undefined)?.toLowerCase?.()?.trim();

            if (!query) {
                return { services: services.map(formatServiceForTool) };
            }

            // Extract numbers from query (e.g., "7 seater" -> 7, "7-8 seater" -> [7,8])
            const queryNumbers = query.match(/\d+/g)?.map(Number) || [];
            const queryWords = query.split(/[\s,]+/).filter(w => w.length > 2);

            const synonyms: Record<string, string[]> = {
                'sectional': ['sectional', 'l-shaped', 'l shaped', 'corner', 'modular'],
                'sofa': ['sofa', 'couch', 'settee', 'loveseat', 'seater'],
                'carpet': ['carpet', 'rug', 'floor'],
                'mattress': ['mattress', 'bed'],
            };

            const expandedQueryWords = new Set(queryWords);
            for (const word of queryWords) {
                for (const [key, syns] of Object.entries(synonyms)) {
                    if (syns.includes(word) || key === word) {
                        syns.forEach(s => expandedQueryWords.add(s));
                    }
                }
            }

            const scoredServices = services.map(service => {
                const name = service.name.toLowerCase();
                const desc = (service.description || '').toLowerCase();
                let score = 0;

                if (name.includes(query)) score += 100;

                const serviceNumbers = name.match(/\d+/g)?.map(Number) || [];

                if (queryNumbers.length > 0 && serviceNumbers.length > 0) {
                    for (const qNum of queryNumbers) {
                        if (serviceNumbers.includes(qNum)) score += 50;
                        if (serviceNumbers.length >= 2) {
                            const min = Math.min(...serviceNumbers);
                            const max = Math.max(...serviceNumbers);
                            if (qNum >= min && qNum <= max) score += 40;
                        }
                    }
                }

                for (const word of Array.from(expandedQueryWords)) {
                    if (name.includes(word)) score += 10;
                    if (desc.includes(word)) score += 5;
                }

                return { service, score };
            });

            const filtered = scoredServices
                .filter(s => s.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(s => s.service);

            const result = filtered.length > 0 ? filtered : services;
            return { services: result.map(formatServiceForTool) };
        }
        case CHAT_TOOL.GET_SERVICE_DETAILS: {
            const serviceId = Number(args?.service_id);
            if (!serviceId) return { error: 'Service ID is required' };
            const service = await chatDeps.storage.getService(serviceId);
            if (!service) return { error: 'Service not found' };
            return { service: formatServiceForTool(service) };
        }
        case CHAT_TOOL.SUGGEST_BOOKING_DATES: {
            const serviceId = Number(args?.service_id);
            const specificDate = args?.specific_date as string | undefined;
            const maxSuggestions = Math.min(Math.max(Number(args?.max_suggestions) || 3, 1), 5); // Default 3, max 5

            if (!serviceId) return { error: 'Service ID is required' };
            const service = await chatDeps.storage.getService(serviceId);
            if (!service) return { error: 'Service not found' };

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

            // Check range of dates - 10 days by default, or 3 days around specific date
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
                    availableSlots: pickRandomSlots(d.availableSlots || [], 4) // Show diverse random slots
                }));

                const formattedText = formatAvailabilityResponse(suggestions);

                return {
                    suggestions,
                    formattedText,
                    timeZone,
                    calendarProvider: useGhl ? 'gohighlevel' : 'local'
                };
            } catch (error: any) {
                console.error('[suggest_booking_dates] Error:', error);
                return {
                    error: 'Failed to check availability',
                    message: getErrorMessage('availabilityCheckFailed', language)
                };
            }
        }
        case CHAT_TOOL.GET_BUSINESS_POLICIES: {
            const company = await chatDeps.storage.getCompanySettings();
            const businessHours = await chatDeps.storage.getBusinessHours();
            return {
                businessName: company?.companyName || 'Skleanings',
                email: company?.companyEmail,
                phone: company?.companyPhone,
                address: company?.companyAddress,
                minimumBookingValue: company?.minimumBookingValue,
                businessHours: formatBusinessHoursSummary(businessHours),
            };
        }
        case CHAT_TOOL.SEARCH_FAQS: {
            const query = (args?.query as string | undefined)?.toLowerCase?.()?.trim();
            const allFaqs = await getCachedFaqs();

            // If no query, return all FAQs
            if (!query) {
                return {
                    faqs: allFaqs.map(faq => ({
                        question: faq.question,
                        answer: faq.answer,
                    })),
                };
            }

            const normalize = (value: string) =>
                value
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
            const tokenized = normalize(query).split(/[^a-z0-9]+/).filter(Boolean);
            const synonymMap: Record<string, string[]> = {
                pet: ['pet', 'pets', 'animal', 'dog', 'cat'],
                children: ['children', 'child', 'kids', 'kid', 'baby'],
                safe: ['safe', 'safety', 'seguro', 'segura'],
                products: ['product', 'products', 'chemicals', 'cleaners', 'detergent'],
                cancellation: ['cancel', 'cancellation', 'reschedule', 'refund'],
                guarantee: ['guarantee', 'warranty', 'satisfaction'],
                payment: ['payment', 'pay', 'card', 'cash', 'invoice'],
            };

            const expandedTokens = new Set<string>();
            for (const token of tokenized) {
                expandedTokens.add(token);
                for (const [key, values] of Object.entries(synonymMap)) {
                    if (token === key || values.includes(token)) {
                        values.forEach((val) => expandedTokens.add(val));
                        expandedTokens.add(key);
                    }
                }
            }

            const scored = allFaqs.map((faq) => {
                const haystack = `${normalize(faq.question || '')} ${normalize(faq.answer || '')}`;
                let score = 0;

                if (haystack.includes(normalize(query))) score += 50;
                for (const token of Array.from(expandedTokens)) {
                    if (token.length < 2) continue;
                    if (haystack.includes(token)) score += 6;
                }

                return { faq, score };
            });

            const filtered = scored
                .filter((item) => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map((item) => item.faq);

            const fallbackFaqs = filtered.length === 0
                ? allFaqs.slice(0, 3)
                : filtered;

            return {
                faqs: fallbackFaqs.map(faq => ({
                    question: faq.question,
                    answer: faq.answer,
                })),
                searchQuery: query,
                resultCount: filtered.length,
                usedFallback: filtered.length === 0,
            };
        }
        case CHAT_TOOL.UPDATE_CONTACT: {
            const name = (args?.name as string | undefined)?.trim();
            const email = (args?.email as string | undefined)?.trim();
            const phone = (args?.phone as string | undefined)?.trim();
            if (!conversationId) return { error: 'Conversation ID missing' };
            if (!name && !email && !phone) return { error: 'Provide at least one of name, email, or phone' };

            const updates: any = {};
            if (name) updates.visitorName = name;
            if (email) updates.visitorEmail = email;
            if (phone) updates.visitorPhone = phone;

            const updated = await chatDeps.storage.updateConversation(conversationId, updates);
            const chatSettings = await chatDeps.storage.getChatSettings();
            const ghlSettings = await chatDeps.storage.getIntegrationSettings('gohighlevel');
            const calendarProvider = chatSettings?.calendarProvider || 'gohighlevel';
            const requiresGhl = calendarProvider === 'gohighlevel';
            const canSyncGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.locationId);
            let contactId: string | undefined;

            if (requiresGhl && !canSyncGhl) {
                return { error: 'GoHighLevel integration is required to sync contacts. Please configure GHL.' };
            }

            if (canSyncGhl && ghlSettings?.apiKey && ghlSettings?.locationId) {
                const contactName = updated?.visitorName || name || '';
                const nameParts = contactName.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                const contactEmail = updated?.visitorEmail || email || '';
                const contactPhone = updated?.visitorPhone || phone || '';

                if (contactEmail || contactPhone) {
                    const contactResult = await chatDeps.ghl.getOrCreateGHLContact(
                        ghlSettings.apiKey,
                        ghlSettings.locationId,
                        {
                            email: contactEmail || '',
                            firstName,
                            lastName,
                            phone: contactPhone || '',
                            address: undefined,
                        }
                    );
                    if (!contactResult.success || !contactResult.contactId) {
                        console.error(`[update_contact] GHL contact creation failed:`, contactResult.message);
                        await addInternalConversationMessage(
                            conversationId,
                            `[WARNING] GHL contact sync failed: ${contactResult.message || 'Unknown error'}. Contact saved locally only.`,
                            {
                                type: 'ghl_contact_error',
                                severity: 'warning',
                                error: contactResult.message,
                                requiresManualSync: true,
                            }
                        );
                        // Don't block - contact data is already saved locally at line above
                    } else {
                        contactId = contactResult.contactId;
                        await addInternalConversationMessage(
                            conversationId,
                            `GHL contact synced: ${contactName || 'Unknown'} | ${contactEmail || 'no email'} | ${contactPhone || 'no phone'} | ID ${contactId}`,
                            {
                                type: 'ghl_contact',
                                ghlContactId: contactId,
                                name: contactName || undefined,
                                email: contactEmail || undefined,
                                phone: contactPhone || undefined,
                            }
                        );
                    }
                }
            }

            return {
                success: true,
                visitorName: updated?.visitorName,
                visitorEmail: updated?.visitorEmail,
                visitorPhone: updated?.visitorPhone,
                ghlContactId: contactId,
            };
        }
        case CHAT_TOOL.UPDATE_MEMORY: {
            if (!conversationId) return { error: 'Conversation ID missing' };

            // Get current conversation to merge memory
            const conversation = await chatDeps.storage.getConversation(conversationId);
            if (!conversation) return { error: 'Conversation not found' };

            const currentMemory = (conversation.memory as any) || { collectedData: {}, completedSteps: [] };
            const collectedData = currentMemory.collectedData || {};
            const completedSteps = currentMemory.completedSteps || [];

            // Update service info
            if (args?.selected_service) {
                currentMemory.selectedService = args.selected_service;
            }

            // Update collected data fields
            if (args?.zipcode) collectedData.zipcode = args.zipcode;
            if (args?.service_type) collectedData.serviceType = args.service_type;
            if (args?.service_details) collectedData.serviceDetails = args.service_details;
            if (args?.preferred_date) collectedData.preferredDate = args.preferred_date;
            if (args?.selected_date) collectedData.selectedDate = args.selected_date;
            if (args?.selected_time) collectedData.selectedTime = args.selected_time;
            if (args?.name) collectedData.name = args.name;
            if (args?.phone) collectedData.phone = args.phone;
            if (args?.email) collectedData.email = args.email;
            if (args?.address) collectedData.address = args.address;

            // Update current step
            if (args?.current_step) {
                currentMemory.currentStep = args.current_step;
            }

            // Mark completed step
            if (args?.completed_step && !completedSteps.includes(args.completed_step)) {
                completedSteps.push(args.completed_step);
            }

            currentMemory.collectedData = collectedData;
            currentMemory.completedSteps = completedSteps;

            // Also update conversation fields for backward compatibility
            const conversationUpdates: any = { memory: currentMemory };
            if (args?.zipcode) conversationUpdates.visitorZipcode = args.zipcode;
            if (args?.address) conversationUpdates.visitorAddress = args.address;
            if (args?.name) conversationUpdates.visitorName = args.name;
            if (args?.phone) conversationUpdates.visitorPhone = args.phone;
            if (args?.email) conversationUpdates.visitorEmail = args.email;

            await chatDeps.storage.updateConversation(conversationId, conversationUpdates);

            return {
                success: true,
                memory: currentMemory,
            };
        }
        case CHAT_TOOL.ADD_SERVICE: {
            if (!conversationId) return { error: 'Conversation ID missing' };

            let serviceId = Number(args?.service_id);
            const serviceName = (args?.service_name as string) || '';
            const price = Number(args?.price);
            const quantityArg = Math.max(Number(args?.quantity) || 1, 1);

            if (!serviceName) {
                return { error: 'Missing service_name' };
            }

            let service = serviceId ? await chatDeps.storage.getService(serviceId) : undefined;
            const normalizedName = normalizeServiceName(serviceName);

            if (service && normalizeServiceName(service.name || '') !== normalizedName) {
                // Mismatch between ID and name: resolve by name
                service = undefined;
            }

            if (!service) {
                const allServices = await getCachedServices();
                const exactMatch = allServices.find((s) => normalizeServiceName(s.name || '') === normalizedName);
                if (exactMatch) {
                    service = exactMatch;
                    serviceId = exactMatch.id;
                } else {
                    const candidates = allServices.filter((s) => {
                        const candidateName = normalizeServiceName(s.name || '');
                        return candidateName.includes(normalizedName) || normalizedName.includes(candidateName);
                    });
                    if (candidates.length > 0) {
                        candidates.sort((a, b) => normalizeServiceName(b.name || '').length - normalizeServiceName(a.name || '').length);
                        const bestMatch = candidates[0];
                        service = bestMatch;
                        serviceId = bestMatch.id;
                    }
                }
            }

            if (!service || !serviceId) {
                return { error: 'Service not found for provided name' };
            }

            const resolvedUnitPrice = Number(service.price);
            const unitPrice = Number.isNaN(resolvedUnitPrice) ? price : resolvedUnitPrice;

            // Get current conversation to update cart
            const conversation = await chatDeps.storage.getConversation(conversationId);
            if (!conversation) return { error: 'Conversation not found' };

            const currentMemory = (conversation.memory as any) || { collectedData: {}, completedSteps: [], cart: [] };
            const cart = currentMemory.cart || [];
            const autoAddedServices = Array.isArray(currentMemory.autoAddedServices) ? currentMemory.autoAddedServices : [];
            const autoAddedMessageId = currentMemory.autoAddedMessageId;

            if (
                autoAddedMessageId &&
                options?.userMessageId &&
                autoAddedMessageId === options.userMessageId &&
                autoAddedServices.includes(normalizedName)
            ) {
                const total = cart.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
                return {
                    success: true,
                    cart,
                    total,
                    message: `Already added ${service.name || serviceName} to cart.`,
                };
            }

            // Check if service already in cart
            const existingIndex = cart.findIndex((item: any) => {
                const itemName = normalizeServiceName(item.serviceName || '');
                return item.serviceId === serviceId || itemName === normalizedName;
            });
            if (existingIndex >= 0) {
                const existing = cart[existingIndex];
                const existingQty = Number(existing.quantity) || 1;
                const nextQty = existingQty + quantityArg;
                const existingUnitPrice = Number(existing.unitPrice) || Number(existing.price) || unitPrice;
                cart[existingIndex] = {
                    ...existing,
                    serviceId,
                    serviceName: service.name || serviceName,
                    unitPrice: existingUnitPrice,
                    quantity: nextQty,
                    price: Number(existingUnitPrice) * nextQty,
                };
                currentMemory.cart = cart;
                await chatDeps.storage.updateConversation(conversationId, { memory: currentMemory });

                const total = cart.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
                return {
                    success: true,
                    message: `Updated ${service.name || serviceName} quantity to ${nextQty}`,
                    cart,
                    total
                };
            }

            // Add to cart
            cart.push({
                serviceId,
                serviceName: service.name || serviceName,
                unitPrice,
                quantity: quantityArg,
                price: unitPrice * quantityArg,
            });
            currentMemory.cart = cart;

            currentMemory.collectedData = {
                ...currentMemory.collectedData,
                serviceType: currentMemory.collectedData?.serviceType || service.name || serviceName,
                serviceDetails: currentMemory.collectedData?.serviceDetails || service.name || serviceName,
            };
            currentMemory.completedSteps = currentMemory.completedSteps || [];
            if (!currentMemory.completedSteps.includes('serviceType')) {
                currentMemory.completedSteps.push('serviceType');
            }
            if (!currentMemory.completedSteps.includes('serviceDetails')) {
                currentMemory.completedSteps.push('serviceDetails');
            }

            await chatDeps.storage.updateConversation(conversationId, { memory: currentMemory });

            const total = cart.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);

            return {
                success: true,
                added: { serviceId, serviceName: service.name || serviceName, price: unitPrice * quantityArg, quantity: quantityArg, unitPrice },
                cart,
                total,
                message: `Added ${service.name || serviceName} (${quantityArg} x $${unitPrice}) to cart. Total: $${total}`
            };
        }
        case CHAT_TOOL.VIEW_CART: {
            if (!conversationId) return { error: 'Conversation ID missing' };

            const conversation = await chatDeps.storage.getConversation(conversationId);
            if (!conversation) return { error: 'Conversation not found' };

            const currentMemory = (conversation.memory as any) || { cart: [] };
            const cart = currentMemory.cart || [];
            const serviceIds = cart.map((item: any) => Number(item.serviceId)).filter(Boolean);
            const services = serviceIds.length > 0 ? await chatDeps.storage.getServices(undefined, undefined, false) : [];
            const serviceMap = new Map(services.map((service) => [service.id, service]));
            const categories = await chatDeps.storage.getCategories();
            const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

            const normalizedCart = cart.map((item: any) => {
                const quantity = Number(item.quantity) || 1;
                const unitPrice = Number(item.unitPrice) || (Number(item.price) / quantity) || 0;
                const lineTotal = Number(item.price) || unitPrice * quantity;
                const service = serviceMap.get(Number(item.serviceId));
                const categoryName = service?.categoryId ? categoryMap.get(service.categoryId) : undefined;
                return {
                    serviceId: item.serviceId,
                    serviceName: item.serviceName,
                    quantity,
                    unitPrice,
                    lineTotal,
                    categoryName,
                };
            });

            const total = normalizedCart.reduce((sum: number, item: any) => sum + Number(item.lineTotal || 0), 0);

            return {
                success: true,
                cart: normalizedCart,
                total,
                serviceIds,
                isEmpty: normalizedCart.length === 0
            };
        }
        case CHAT_TOOL.CREATE_BOOKING: {
            const correlationId = `book_${Date.now()}_${conversationId?.slice(0, 8) || 'unknown'}`;
            const bookingStartTime = Date.now();

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
                    rawServiceItems = []; // clear raw items if we fallback to cart to avoid processing mismatch
                    console.log(`[create_booking:${correlationId}] Using cart service IDs due to mismatch:`, {
                        providedIds,
                        cartServiceIds,
                    });
                }
            }

            // If no service_ids provided, get them from cart in memory
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

            const normalizedItems = rawServiceItems.length > 0
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

            // Check booking limit per conversation (spam prevention)
            if (conversationId && !canCreateBooking(conversationId)) {
                return {
                    success: false,
                    error: 'Booking limit reached for this conversation.',
                    userMessage: getErrorMessage('bookingLimitReached', language),
                };
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
                return {
                    success: false,
                    error,
                    userMessage: getErrorMessage('systemUnavailable', language),
                };
            }

            const services = [];
            const bookingItemsData: any[] = [];
            let totalPrice = 0;
            let totalDuration = 0;

            for (const item of normalizedItems) {
                const service = await chatDeps.storage.getService(item.serviceId);
                if (!service) {
                    return {
                        success: false,
                        error: `Service ID ${item.serviceId} not found`,
                        userMessage: getErrorMessage('systemUnavailable', language),
                    };
                }

                const pricingType = service.pricingType || 'fixed_item';
                if (pricingType === 'area_based') {
                    const hasCustomArea = typeof item.areaValue === 'number' && item.areaValue > 0;
                    const hasPreset = !!item.areaSize && item.areaSize !== 'custom';
                    if (!hasCustomArea && !hasPreset) {
                        return {
                            success: false,
                            error: 'Missing area size for area-based service.',
                            userMessage: 'Please share the size or square footage so I can price this correctly.',
                        };
                    }
                    if (item.areaSize === 'custom' && !hasCustomArea) {
                        return {
                            success: false,
                            error: 'Missing square footage for custom area size.',
                            userMessage: 'Please share the square footage so I can price this correctly.',
                        };
                    }
                }

                if (pricingType === 'custom_quote' && !item.customerNotes && notes) {
                    item.customerNotes = notes;
                }

                const options = await chatDeps.storage.getServiceOptions(service.id);
                const frequencies = await chatDeps.storage.getServiceFrequencies(service.id);
                const calculated = await calculateCartItemPrice(service, item, options, frequencies);

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

            // Calculate end time
            const startDate = new Date(`2000-01-01T${startTime}:00`);
            startDate.setMinutes(startDate.getMinutes() + totalDuration);
            const endHour = startDate.getHours().toString().padStart(2, '0');
            const endMinute = startDate.getMinutes().toString().padStart(2, '0');
            const endTime = `${endHour}:${endMinute}`;

            // Acquire lock to prevent race condition
            if (conversationId && !(await acquireTimeSlotLock(bookingDate, startTime, conversationId))) {
                console.log(`[create_booking:${correlationId}] Time slot is locked by another booking:`, { bookingDate, startTime });
                return {
                    success: false,
                    error: 'This time slot is being booked by another customer. Please select a different time.',
                    userMessage: getErrorMessage('availabilityCheckFailed', language),
                };
            }

            // Check for conflicts
            try {
                const existingBookings = await chatDeps.storage.getBookingsByDate(bookingDate);
                const hasConflict = existingBookings.some(b => startTime < b.endTime && endTime > b.startTime);
                if (hasConflict) {
                    if (conversationId) await releaseTimeSlotLock(bookingDate, startTime, conversationId);
                    return {
                        success: false,
                        error: 'Time slot is no longer available.',
                        userMessage: getErrorMessage('availabilityCheckFailed', language),
                    };
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
                    return {
                        success: false,
                        error: errorMsg,
                        userMessage: getErrorMessage('availabilityCheckFailed', language)
                    };
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
                    return {
                        success: false,
                        error: 'Selected time is unavailable. Choose another slot.',
                        userMessage: getErrorMessage('availabilityCheckFailed', language),
                        availableSlots: slotsForDay
                    };
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

                const serviceNames = services.map(s => s.name).join(', ');
                const ghlSync = await syncBookingToGhl(booking, serviceNames);
                const pendingSync = ghlSync.attempted && !ghlSync.synced;

                if (conversationId) {
                    await chatDeps.storage.updateConversation(conversationId, {
                        visitorName: customerName,
                        visitorEmail: customerEmail,
                        visitorPhone: customerPhone,
                    });
                    const ghlSyncLabel = ghlSync.synced
                        ? `Contact ${ghlSync.contactId} | Appointment ${ghlSync.appointmentId}`
                        : (ghlSync.attempted ? `GHL sync failed` : `GHL sync skipped`);
                    await addInternalConversationMessage(
                        conversationId,
                        `[SUCCESS] Booking created: ${bookingDate} ${startTime}-${endTime} | ${services.map(s => s.name).join(', ')} | $${totalPrice.toFixed(2)} | ${ghlSyncLabel}`,
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
                            services: services.map(s => ({ id: s.id, name: s.name })),
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
                        services: services.map(s => ({ id: s.id, name: s.name })),
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
                    services: services.map(s => ({ id: s.id, name: s.name })),
                    minimumAdjustmentNote,
                    userMessage: 'Booking confirmed!',
                };

            } catch (err: any) {
                console.error('[create_booking] Error:', err);
                if (conversationId) {
                    await releaseTimeSlotLock(bookingDate, startTime, conversationId);
                }
                return {
                    success: false,
                    error: 'An unexpected error occurred.',
                    userMessage: getErrorMessage('systemUnavailable', language),
                };
            }
        }
        default:
            return { error: `Tool ${toolName} not implemented or found` };
    }
}
