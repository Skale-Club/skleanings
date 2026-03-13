
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
import { initializeChatToolRegistry } from "./tools/bootstrap";
import {
    buildChatTools as buildRegisteredChatTools,
    getTool as getRegisteredTool,
    runTool as runRegisteredTool,
} from "./tools/registry";

// Simple TTL cache for frequently queried data in chat tools
const chatCache = {
    services: { data: null as any[] | null, expiry: 0 },
    faqs: { data: null as any[] | null, expiry: 0 },
};
const CACHE_TTL_MS = CACHE_TTL.SERVICES; // Use constant from constants.ts

initializeChatToolRegistry();

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
    const semantic = getServiceSemanticProfile(service);
    return {
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price?.toString?.() || service.price,
        serviceFamily: semantic.family,
        matchHints: semantic.matchHints,
    };
}

function normalizeSemanticText(value: string): string {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function getServiceSemanticProfile(service: any): { family: string; matchHints: string[] } {
    const source = normalizeSemanticText(`${service?.name || ''} ${service?.description || ''}`);
    const hints = new Set<string>();
    let family = 'general';

    const addSeatHints = (text: string) => {
        const seatMatch = text.match(/(\d+)(?:\s*-\s*(\d+)|\+)?\s*seater/);
        if (!seatMatch) return;
        if (seatMatch[2]) {
            hints.add(`${seatMatch[1]}-${seatMatch[2]} seater`);
            hints.add(`${seatMatch[1]} to ${seatMatch[2]} seats`);
        } else if (seatMatch[0].includes('+')) {
            hints.add(`${seatMatch[1]}+ seater`);
            hints.add(`${seatMatch[1]} or more seats`);
        } else {
            hints.add(`${seatMatch[1]} seater`);
            hints.add(`${seatMatch[1]} seats`);
        }
    };

    if (/\b(sofa|couch|loveseat|sectional|settee|l-shaped|l shaped)\b/.test(source)) {
        family = 'sofa';
        hints.add('sofa');
        hints.add('couch');
        hints.add('upholstery');
        addSeatHints(source);
        if (/\bloveseat\b/.test(source)) {
            hints.add('loveseat');
            hints.add('small sofa');
            hints.add('2 seater');
        }
        if (/\b(l-shaped|l shaped|corner)\b/.test(source)) {
            hints.add('l-shaped');
            hints.add('corner sofa');
        }
        if (/\bsectional|modular\b/.test(source)) {
            hints.add('sectional');
            hints.add('modular sofa');
        }
    } else if (/\b(mattress|bed frame|headboard|bed)\b/.test(source)) {
        family = 'bed';
        if (/\bmattress\b/.test(source)) {
            hints.add('mattress');
            hints.add('bed');
        }
        if (/\bheadboard\b/.test(source)) hints.add('headboard');
        if (/\bbed frame\b/.test(source)) hints.add('bed frame');
        for (const size of ['twin', 'full', 'queen', 'king']) {
            if (source.includes(size)) hints.add(size);
        }
    } else if (/\b(carpet|rug|hallway|stairs|basement|attic|room)\b/.test(source)) {
        family = 'carpet';
        hints.add('carpet');
        hints.add('rug');
        hints.add('floor cleaning');
        for (const area of ['small room', 'medium room', 'large room', 'hallway', 'stairs', 'basement', 'attic', 'home']) {
            if (source.includes(area)) hints.add(area);
        }
    } else if (/\b(chair|armchair|recliner|chaise lounge|chaise|office chair|dining chair)\b/.test(source)) {
        family = 'chair';
        hints.add('chair');
        for (const kind of ['armchair', 'recliner', 'office chair', 'dining chair', 'chaise lounge']) {
            if (source.includes(kind)) hints.add(kind);
        }
    } else if (/\b(curtain|drape)\b/.test(source)) {
        family = 'curtain';
        hints.add('curtain');
        hints.add('drape');
        hints.add('window treatment');
    }

    return {
        family,
        matchHints: Array.from(hints),
    };
}

function buildClarificationQuestion(query: string, candidateServices: any[]): string | null {
    if (!query || candidateServices.length < 2) return null;

    const normalizedQuery = normalizeSemanticText(query);
    const profiles = candidateServices.map((service) => getServiceSemanticProfile(service));
    const familyCounts = profiles.reduce((acc, profile) => {
        acc.set(profile.family, (acc.get(profile.family) || 0) + 1);
        return acc;
    }, new Map<string, number>());
    const topFamily = [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    if (!topFamily || (familyCounts.get(topFamily) || 0) < 2) return null;

    const hasSeatCount = /\b\d+\s*(?:-|to)?\s*\d*\s*seater\b|\b\d+\s*seat\b/.test(normalizedQuery);
    const hasMattressSize = /\b(twin|full|queen|king)\b/.test(normalizedQuery);
    const hasCarpetArea = /\b(small|medium|large|hallway|stairs|basement|attic|home|room|runner)\b/.test(normalizedQuery);
    const hasChairSubtype = /\b(armchair|recliner|office|dining|chaise)\b/.test(normalizedQuery);

    if (topFamily === 'sofa') {
        const mentionsSpecificShape = /\b(l-shaped|l shaped|corner|sectional|loveseat|modular)\b/.test(normalizedQuery);
        if (mentionsSpecificShape && !hasSeatCount && /\b(sectional|l-shaped|l shaped|corner|modular)\b/.test(normalizedQuery)) {
            return 'How many people does the sofa seat?';
        }
        if (!mentionsSpecificShape || !hasSeatCount) {
            return 'How many people does the sofa seat, and is it a straight sofa, an L-shaped sofa, or a sectional?';
        }
    }

    if (topFamily === 'bed' && /\b(mattress|bed)\b/.test(normalizedQuery) && !hasMattressSize) {
        return 'What size is the mattress?';
    }

    if (topFamily === 'carpet' && /\b(carpet|rug)\b/.test(normalizedQuery) && !hasCarpetArea) {
        return 'About how large is the carpeted area, and is it a room, hallway, stairs, or another area?';
    }

    if (topFamily === 'chair' && /\bchair\b/.test(normalizedQuery) && !hasChairSubtype) {
        return 'What kind of chair is it?';
    }

    return null;
}

function hasStrongTopServiceMatch(
    query: string,
    rankedServices: Array<{ service: any; score: number }>
): boolean {
    const top = rankedServices[0];
    if (!top || top.score <= 0) return false;

    const second = rankedServices[1];
    const normalizedQuery = normalizeSemanticText(query);
    const topName = normalizeSemanticText(top.service?.name || '');
    const topDescription = normalizeSemanticText(top.service?.description || '');
    const queryTokens = normalizedQuery.split(/[^a-z0-9]+/).filter((token) => token.length > 2);

    const tokenCoverage = queryTokens.length === 0
        ? 0
        : queryTokens.filter((token) => topName.includes(token) || topDescription.includes(token)).length / queryTokens.length;

    if (topName.includes(normalizedQuery) || tokenCoverage >= 0.8) {
        return true;
    }

    if (!second) return top.score >= 40;

    return top.score >= 70 && (top.score - second.score) >= 20;
}

// Build chat tools dynamically based on intake flow configuration
export function buildChatTools(enabledObjectives: IntakeObjective[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    const registeredTools = buildRegisteredChatTools(enabledObjectives);
    const registeredToolsByName = new Map(
        registeredTools.map((tool) => [tool.function.name, tool])
    );
    const legacySchemaToolNames = new Set<string>([CHAT_TOOL.CREATE_BOOKING]);

    // Determine which fields are required based on intake flow
    const enabledIds = new Set(enabledObjectives.map(o => o.id));

    // Map intake objective IDs to create_booking field names
    const bookingRequiredFields: string[] = ['service_ids', 'booking_date', 'start_time'];
    if (enabledIds.has('name')) bookingRequiredFields.push('customer_name');
    if (enabledIds.has('phone')) bookingRequiredFields.push('customer_phone');
    if (enabledIds.has('address')) bookingRequiredFields.push('customer_address');
    // Note: email is only required if explicitly in intake flow (not by default)

    const legacyTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
            type: "function",
            function: {
                name: CHAT_TOOL.LIST_SERVICES,
                description: "List all available cleaning services from our catalog. Results include descriptions, semantic match hints, and may include a clarificationQuestion when the customer's request is still ambiguous. If clarificationQuestion is present, ask that instead of listing internal catalog options. CRITICAL: You must ONLY recommend services that exist in this list. Never combine multiple smaller services when a single larger service exists. For example, if customer needs a 7-seater cleaned, recommend the 7-8 Seater service, NOT multiple 3-seater sessions.",
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

    const mergedTools = legacyTools.map((tool) => {
        if (legacySchemaToolNames.has(tool.function.name)) {
            return tool;
        }
        const registeredTool = registeredToolsByName.get(tool.function.name);
        return registeredTool || tool;
    });

    const legacyToolNames = new Set(legacyTools.map((tool) => tool.function.name));
    for (const registeredTool of registeredTools) {
        if (!legacyToolNames.has(registeredTool.function.name)) {
            mergedTools.push(registeredTool);
        }
    }

    return mergedTools;
}

export async function runChatTool(
    toolName: string,
    args: any,
    conversationId?: string,
    options?: { allowFaqs?: boolean; allowKnowledgeBase?: boolean; language?: string; userMessage?: string; userMessageId?: string }
) {
    return runRegisteredTool(toolName, args, conversationId, {
        language: options?.language,
        userMessage: options?.userMessage,
        userMessageId: options?.userMessageId,
    });
}
