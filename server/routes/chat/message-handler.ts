import { Request, Response } from "express";
import { z } from "zod";
import OpenAI from "openai";
import crypto from "crypto";
import { chatDeps } from "./dependencies";
import { conversationEvents } from "../../lib/chat-events";
import { getTodayStr } from "../../lib/availability";
import { isRateLimited } from "../../lib/rate-limit";
import {
    DEFAULT_BUSINESS_HOURS,
    BusinessHours,
} from "@shared/schema";
import {
    formatBusinessHoursSummary,
    formatAvailabilityResponse,
    formatDateLabel,
    formatTimeLabel,
    detectDateWindowFromText,
    parseRelativeDateFromText,
    parseTimeFromText,
    parseZipFromText,
    parsePhoneFromText,
    parseNameFromText,
    parseAddressFromText,
    looksLikeName,
    looksLikeAddress,
    detectMessageLanguage,
    isLikelyDirectQuestion,
    isAffirmativeResponse,
    isServiceConfirmationPrompt,
    isBookingConfirmationPrompt,
    responseMentionsObjective,
    getIntakeQuestion,
    getNextIntakeObjective,
    sanitizeAssistantResponse,
    normalizeServiceName,
    getChatPromptTemplate,
    IntakeObjective,
    DEFAULT_INTAKE_OBJECTIVES,
    UrlRule,
    urlRuleSchema
} from "./utils";
import { DEFAULT_CHAT_MODEL } from "../../lib/openai";
import { DEFAULT_GEMINI_CHAT_MODEL } from "../../lib/gemini";
import { DEFAULT_OPENROUTER_CHAT_MODEL } from "../../lib/openrouter";
import {
    buildChatTools,
    runChatTool,
    getCachedServices
} from "./tools";
import {
    CONVERSATION_STATUS,
    MESSAGE_ROLE,
    URL_MATCH_TYPE,
    AUTO_CAPTURE,
    OPENAI_CONFIG,
    CHAT_TOOL
} from "./constants";

type AIProvider = "openai" | "gemini" | "openrouter";

// Chat input schema
const chatMessageSchema = z.object({
    conversationId: z.string().uuid().optional(),
    message: z.string().min(1).max(2000),
    pageUrl: z.string().optional(),
    visitorId: z.string().optional(),
    userAgent: z.string().optional(),
    visitorName: z.string().optional(),
    visitorEmail: z.string().optional(),
    visitorPhone: z.string().optional(),
    language: z.string().optional(),
});

function isUrlExcluded(url: string, rules: UrlRule[]): boolean {
    if (!url || !rules.length) return false;

    try {
        // Accept both absolute URLs and path-only values such as "/booking".
        const urlObj = new URL(url, "http://localhost");
        const path = urlObj.pathname;

        return rules.some(rule => {
            if (rule.match === URL_MATCH_TYPE.EQUALS) {
                return path === rule.pattern;
            } else if (rule.match === URL_MATCH_TYPE.CONTAINS) {
                return path.includes(rule.pattern);
            } else if (rule.match === URL_MATCH_TYPE.STARTS_WITH) {
                return path.startsWith(rule.pattern);
            }
            return false;
        });
    } catch (e) {
        return false;
    }
}

// Load chat prompt template
const CHAT_PROMPT_TEMPLATE = getChatPromptTemplate() || `You are a friendly booking assistant for {{companyName}}. {{industryLine}}
Your personality: Warm, helpful, and efficient.

## INTAKE FLOW
{{intakeFlowText}}

RULES:
- Ask ONE question at a time
- Be conversational but concise
- No filler phrases like "Great!", "Perfect!"
 - Today is {{currentDateISO}} ({{timeZone}})
- Interpret "next <weekday>" as the next upcoming weekday within 7 days

## REQUIRED FIELDS: {{requiredFieldsList}}

{{languageInstruction}}`;

/**
 * ✅ DEDUPLICATED: Auto-booking helper function
 * Attempts to create a booking when all required data is available
 * @returns { success: boolean, result: any, bookingCompleted?: object }
 */
async function attemptAutoBooking(
    conversationId: string,
    reason: string,
    options: {
        allowFaqs?: boolean;
        language?: string;
        userMessage?: string;
        userMessageId?: string;
    }
): Promise<{ success: boolean; result: any; bookingCompleted?: any }> {
    const convForAutoBook = await chatDeps.storage.getConversation(conversationId);
    const memForAutoBook = (convForAutoBook?.memory as any) || {};
    const collectedForAutoBook = memForAutoBook.collectedData || {};
    const cartForAutoBook = Array.isArray(memForAutoBook.cart) ? memForAutoBook.cart : [];

    const hasServices = cartForAutoBook.length > 0;
    const hasDate = !!(collectedForAutoBook.selectedDate || collectedForAutoBook.preferredDate);
    const hasTime = !!collectedForAutoBook.selectedTime;
    const hasName = !!(collectedForAutoBook.name || convForAutoBook?.visitorName);
    const hasPhone = !!(collectedForAutoBook.phone || convForAutoBook?.visitorPhone);
    const hasAddress = !!(collectedForAutoBook.address || convForAutoBook?.visitorAddress);

    console.log(`[Chat AutoBook] ${reason} - Requirements:`, { hasServices, hasDate, hasTime, hasName, hasPhone, hasAddress });

    if (!hasServices || !hasDate || !hasTime || !hasName || !hasPhone || !hasAddress) {
        const missing: string[] = [];
        if (!hasServices) missing.push('service selection');
        if (!hasDate) missing.push('preferred date');
        if (!hasTime) missing.push('time slot');
        if (!hasName) missing.push('your name');
        if (!hasPhone) missing.push('phone number');
        if (!hasAddress) missing.push('address');

        console.log('[Chat AutoBook] Cannot proceed, missing:', missing);
        return { success: false, result: null };
    }

    console.log('[Chat AutoBook] All requirements met, creating booking...');

    const bookingArgs = {
        booking_date: collectedForAutoBook.selectedDate || collectedForAutoBook.preferredDate,
        start_time: collectedForAutoBook.selectedTime,
        customer_name: collectedForAutoBook.name || convForAutoBook?.visitorName,
        customer_phone: collectedForAutoBook.phone || convForAutoBook?.visitorPhone,
        customer_address: collectedForAutoBook.address || convForAutoBook?.visitorAddress,
        service_ids: cartForAutoBook.map((item: any) => Number(item.serviceId)).filter(Boolean),
    };

    const autoBookCallId = crypto.randomUUID();
    await chatDeps.storage.addConversationMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: MESSAGE_ROLE.ASSISTANT,
        content: `[AUTO-BOOK] ${reason}`,
        metadata: {
            internal: true,
            type: 'tool_call',
            toolName: CHAT_TOOL.CREATE_BOOKING,
            toolArgs: bookingArgs,
            toolCallId: autoBookCallId,
            reason,
        },
    });

    const autoBookingResult = await runChatTool(CHAT_TOOL.CREATE_BOOKING, bookingArgs, conversationId, options);

    await chatDeps.storage.addConversationMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: MESSAGE_ROLE.ASSISTANT,
        content: `[AUTO-BOOK] Result: ${autoBookingResult.success ? 'Success' : 'Failed - ' + (autoBookingResult.error || 'Unknown error')}`,
        metadata: {
            internal: true,
            type: 'tool_result',
            toolName: CHAT_TOOL.CREATE_BOOKING,
            toolResult: autoBookingResult,
            toolCallId: autoBookCallId,
        },
    });

    console.log('[Chat AutoBook] Result:', autoBookingResult.success ? 'Success' : autoBookingResult.error);

    if (autoBookingResult.success) {
        const bookingCompleted = {
            value: parseFloat(String(autoBookingResult.totalPrice ?? '0')) || 0,
            services: autoBookingResult.services?.map((s: any) => s.name) || []
        };
        return { success: true, result: autoBookingResult, bookingCompleted };
    }

    return { success: false, result: autoBookingResult };
}

async function buildFinalBookingSummary(conversationId: string): Promise<string | null> {
    const conversation = await chatDeps.storage.getConversation(conversationId);
    if (!conversation) return null;

    const memory = (conversation.memory as any) || {};
    const collectedData = memory.collectedData || {};
    const cart = Array.isArray(memory.cart) ? memory.cart : [];

    const bookingDate = collectedData.selectedDate || collectedData.preferredDate;
    const bookingTime = collectedData.selectedTime;
    const customerName = collectedData.name || conversation.visitorName;
    const customerPhone = collectedData.phone || conversation.visitorPhone;
    const customerAddress = collectedData.address || conversation.visitorAddress;

    if (!cart.length || !bookingDate || !bookingTime || !customerName || !customerPhone || !customerAddress) {
        return null;
    }

    const lineItems = cart.map((item: any) => {
        const qty = Math.max(Number(item?.quantity) || 1, 1);
        const lineTotal = Number(item?.price || 0);
        const priceLabel = Number.isInteger(lineTotal) ? String(lineTotal) : lineTotal.toFixed(2);
        return `- ${item?.serviceName || 'Service'}${qty > 1 ? ` x${qty}` : ''}: $${priceLabel}`;
    });

    const total = cart.reduce((sum: number, item: any) => sum + Number(item?.price || 0), 0);
    const totalLabel = Number.isInteger(total) ? String(total) : total.toFixed(2);
    const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(String(bookingDate))
        ? formatDateLabel(String(bookingDate), true)
        : String(bookingDate);
    const timeLabel = typeof bookingTime === 'string' && /^\d{2}:\d{2}$/.test(bookingTime)
        ? formatTimeLabel(bookingTime)
        : String(bookingTime);

    return [
        'Booking summary:',
        ...lineItems,
        `Total: $${totalLabel}`,
        `${dateLabel} at ${timeLabel}`,
        `Name: ${customerName}`,
        `Phone: ${customerPhone}`,
        `Address: ${customerAddress}`,
        'Sound good?',
    ].join('\n');
}

export async function handleMessage(req: Request, res: Response) {
    try {
        const parsed = chatMessageSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: 'Invalid input', errors: parsed.error.errors });
        }
        const input = parsed.data;

        const ipKey = (req.ip || 'unknown').toString();
        const rateLimitKey = `${ipKey}:${input.conversationId || "new"}`;
        if (isRateLimited(rateLimitKey)) {
            return res.status(429).json({ message: 'Too many requests, please slow down.' });
        }

        const settings = await chatDeps.storage.getChatSettings();
        const excludedRules = (settings.excludedUrlRules as UrlRule[]) || [];

        if (!settings.enabled) {
            return res.status(503).json({ message: 'Chat is currently disabled.' });
        }

        if (isUrlExcluded(input.pageUrl || '', excludedRules)) {
            return res.status(403).json({ message: 'Chat is not available on this page.' });
        }

        const [openaiIntegration, geminiIntegration, openrouterIntegration] = await Promise.all([
            chatDeps.storage.getChatIntegration("openai"),
            chatDeps.storage.getChatIntegration("gemini"),
            chatDeps.storage.getChatIntegration("openrouter"),
        ]);

        const integrationsByProvider: Record<AIProvider, typeof openaiIntegration> = {
            openai: openaiIntegration,
            gemini: geminiIntegration,
            openrouter: openrouterIntegration,
        };

        // Determine active provider based on settings and availability
        let activeProvider: AIProvider | null = (settings.activeProvider as AIProvider) || "openai";

        if (!integrationsByProvider[activeProvider]?.enabled) {
            const fallback = (["openai", "gemini", "openrouter"] as AIProvider[]).find(
                (provider) => integrationsByProvider[provider]?.enabled
            );
            activeProvider = fallback || null;
        }

        const integration = activeProvider ? integrationsByProvider[activeProvider] : null;
        if (!activeProvider || !integration) {
            return res.status(503).json({
                message: "No AI integration is enabled. Please enable OpenAI, Gemini, or OpenRouter in Admin -> Integrations.",
            });
        }

        let apiKey = "";
        if (activeProvider === "openai") {
            apiKey = process.env.OPENAI_API_KEY || integration.apiKey || "";
        } else if (activeProvider === "gemini") {
            apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || integration.apiKey || "";
        } else {
            apiKey = process.env.OPENROUTER_API_KEY || integration.apiKey || "";
        }

        if (!apiKey) {
            const providerName = activeProvider === "openai" ? "OpenAI" : activeProvider === "gemini" ? "Gemini" : "OpenRouter";
            return res.status(503).json({
                message: `${providerName} API key is missing. Please configure it in Admin -> Integrations.`,
            });
        }

        const model =
            integration.model ||
            (activeProvider === "openai"
                ? DEFAULT_CHAT_MODEL
                : activeProvider === "gemini"
                    ? DEFAULT_GEMINI_CHAT_MODEL
                    : DEFAULT_OPENROUTER_CHAT_MODEL);
        const conversationId = input.conversationId || crypto.randomUUID();

        let conversation = await chatDeps.storage.getConversation(conversationId);
        const isNewConversation = !conversation;
        if (!conversation) {
            conversation = await chatDeps.storage.createConversation({
                id: conversationId,
                status: CONVERSATION_STATUS.OPEN,
                firstPageUrl: input.pageUrl,
                visitorName: input.visitorName,
                visitorEmail: input.visitorEmail,
                visitorPhone: input.visitorPhone,
            });

            // Send notification for new chat (non-blocking)
            const [twilioSettings, telegramSettings, companySettings] = await Promise.all([
                chatDeps.storage.getTwilioSettings(),
                chatDeps.storage.getTelegramSettings(),
                chatDeps.storage.getCompanySettings(),
            ]);

            if (twilioSettings && isNewConversation) {
                chatDeps.twilio.sendNewChatNotification(
                    twilioSettings,
                    conversationId,
                    input.pageUrl,
                    companySettings?.companyName || 'the business'
                ).catch(err => {
                    console.error('Failed to send Twilio notification:', err);
                });
            }

            if (telegramSettings && isNewConversation) {
                chatDeps.telegram.sendNewChatNotification(
                    telegramSettings,
                    conversationId,
                    input.pageUrl,
                    companySettings?.companyName || 'the business'
                ).catch(err => {
                    console.error('Failed to send Telegram notification:', err);
                });
            }
        } else {
            await chatDeps.storage.updateConversation(conversationId, { lastMessageAt: new Date() });
        }

        if (conversation?.status === CONVERSATION_STATUS.CLOSED) {
            await chatDeps.storage.updateConversation(conversationId, { status: CONVERSATION_STATUS.OPEN });
        }

        const normalizeLanguage = (value?: string | null): string | null => {
            if (!value) return null;
            const normalized = value.trim().toLowerCase();
            if (normalized.startsWith('pt')) return 'pt-BR';
            if (normalized.startsWith('es')) return 'es';
            if (normalized.startsWith('en')) return 'en';
            return null;
        };
        const messageLanguage = normalizeLanguage(input.language) || detectMessageLanguage(input.message);
        const memoryLanguage = normalizeLanguage((conversation?.memory as any)?.language);
        const responseLanguage = messageLanguage || memoryLanguage || 'en';

        const conversationLanguageMemory = (conversation?.memory as any) && typeof conversation?.memory === 'object'
            ? { ...(conversation?.memory as any) }
            : {};
        if (conversationLanguageMemory.language !== responseLanguage) {
            conversationLanguageMemory.language = responseLanguage;
            conversation = await chatDeps.storage.updateConversation(conversationId, {
                memory: conversationLanguageMemory,
            }) || conversation;
        }

        // Check message limit (100 user/assistant messages per conversation, excluding internal debug messages)
        const existingMessages = await chatDeps.storage.getConversationMessages(conversationId);
        const userFacingMessages = existingMessages.filter(m => !(m.metadata as any)?.internal);
        if (userFacingMessages.length >= 100) {
            return res.status(429).json({
                message: 'This conversation has reached the message limit. Please start a new conversation.',
                limitReached: true
            });
        }

        const visitorMessageId = crypto.randomUUID();
        const createdVisitorMessage = await chatDeps.storage.addConversationMessage({
            id: visitorMessageId,
            conversationId,
            role: MESSAGE_ROLE.VISITOR,
            content: input.message.trim(),
            metadata: {
                pageUrl: input.pageUrl,
                userAgent: input.userAgent,
                visitorId: input.visitorId,
                language: responseLanguage,
            },
        });

        // Emit SSE event for visitor message (so admin sees it in real-time)
        const visitorMsgConversation = await chatDeps.storage.getConversation(conversationId);
        conversationEvents.emit('new_message', {
            type: 'new_message',
            conversationId,
            message: createdVisitorMessage,
            conversation: visitorMsgConversation,
        });

        const intakeObjectives = (settings.intakeObjectives as IntakeObjective[] | null) || [];
        const effectiveObjectives = intakeObjectives.length ? intakeObjectives : DEFAULT_INTAKE_OBJECTIVES;
        const normalizedObjectives = [...effectiveObjectives];
        // Keep ZIP code in the flow, but avoid asking it as the very first question.
        const zipIdx = normalizedObjectives.findIndex((obj) => obj.id === "zipcode");
        const detailsIdx = normalizedObjectives.findIndex((obj) => obj.id === "serviceDetails");
        if (zipIdx === 0 && detailsIdx >= 0) {
            const [zipObjective] = normalizedObjectives.splice(zipIdx, 1);
            normalizedObjectives.splice(detailsIdx + 1, 0, zipObjective);
        }
        const enabledObjectives = normalizedObjectives.filter(obj => obj.enabled);

        const autoMessage = input.message.trim();
        const lastAssistantMessage = [...existingMessages]
            .reverse()
            .find((m) => m.role === 'assistant' && !(m.metadata as any)?.internal);
        const isAffirmative = isAffirmativeResponse(autoMessage);
        const userAskedDirectQuestion = isLikelyDirectQuestion(autoMessage);
        const isConfirmPrompt = lastAssistantMessage ? isServiceConfirmationPrompt(lastAssistantMessage.content || '') : false;
        const isBookingConfirm = lastAssistantMessage ? isBookingConfirmationPrompt(lastAssistantMessage.content || '') : false;
        const shouldAutoAddServices = isAffirmative && lastAssistantMessage && isConfirmPrompt && !isBookingConfirm;
        const shouldAutoBook = isAffirmative && lastAssistantMessage && isBookingConfirm;
        let autoLeadCaptured = false;

        console.log('[Chat AutoAdd] Message:', autoMessage, '| isAffirmative:', isAffirmative, '| lastMsg:', lastAssistantMessage?.content?.substring(0, 60), '| isConfirmPrompt:', isConfirmPrompt, '| shouldAutoAdd:', shouldAutoAddServices, '| isBookingConfirm:', isBookingConfirm);

        // Log auto-add evaluation for debugging
        if (isAffirmative) {
            await chatDeps.storage.addConversationMessage({
                id: crypto.randomUUID(),
                conversationId,
                role: MESSAGE_ROLE.ASSISTANT,
                content: `[AUTO-ADD EVAL] isAffirmative: ${isAffirmative}, lastMsg: ${lastAssistantMessage?.content?.substring(0, 40) || 'none'}, isConfirmPrompt: ${isConfirmPrompt}, shouldAutoAdd: ${shouldAutoAddServices}`,
                metadata: { internal: true, type: 'debug' },
            });
        }

        if (shouldAutoAddServices) {
            // Check if cart already has services - if so, no need for safety net
            const currentCart = Array.isArray((conversation?.memory as any)?.cart) ? (conversation?.memory as any).cart : [];

            console.log('[Chat AutoAdd] Cart has', currentCart.length, 'items. Checking if auto-add needed...');

            await chatDeps.storage.addConversationMessage({
                id: crypto.randomUUID(),
                conversationId,
                role: MESSAGE_ROLE.ASSISTANT,
                content: `[AUTO-ADD CHECK] shouldAutoAdd: true, cartItems: ${currentCart.length}`,
                metadata: { internal: true, type: 'debug' },
            });

            if (currentCart.length === 0) {
                // Cart is empty despite user confirming.
                // Retry only the latest add_service call to avoid re-adding stale services.
                const latestToolCall = [...existingMessages]
                    .reverse()
                    .find((m: any) =>
                        m.metadata?.type === 'tool_call' &&
                        m.metadata?.toolName === 'add_service' &&
                        m.metadata?.toolArgs?.service_id
                    );

                const latestServiceId = latestToolCall
                    ? Number((latestToolCall as any).metadata.toolArgs.service_id)
                    : 0;
                let uniqueServiceIds = latestServiceId ? [latestServiceId] : [];

                if (uniqueServiceIds.length === 0 && lastAssistantMessage?.content) {
                    const services = await getCachedServices();
                    const normalizedLastAssistant = normalizeServiceName(lastAssistantMessage.content || '');
                    const inferredService = services
                        .filter((s) => {
                            const normalizedServiceName = normalizeServiceName(s.name || '');
                            return normalizedServiceName.length > 0 && normalizedLastAssistant.includes(normalizedServiceName);
                        })
                        .sort((a, b) => normalizeServiceName(b.name || '').length - normalizeServiceName(a.name || '').length)[0];

                    if (inferredService?.id) {
                        uniqueServiceIds = [Number(inferredService.id)];
                    }
                }

                console.log('[Chat AutoAdd] Cart empty, inferred', uniqueServiceIds.length, 'service IDs to retry:', uniqueServiceIds);

                if (uniqueServiceIds.length > 0) {
                    const services = await getCachedServices();
                    const matchedServices = services.filter((s) => uniqueServiceIds.includes(s.id));

                    for (const service of matchedServices) {
                        const toolArgs = {
                            service_id: service.id,
                            service_name: service.name,
                            price: Number(service.price),
                            quantity: 1,
                        };
                        const toolCallId = crypto.randomUUID();
                        await chatDeps.storage.addConversationMessage({
                            id: crypto.randomUUID(),
                            conversationId,
                            role: MESSAGE_ROLE.ASSISTANT,
                            content: `[TOOL CALL] add_service`,
                            metadata: {
                                internal: true,
                                type: 'tool_call',
                                toolName: 'add_service',
                                toolArgs,
                                toolCallId,
                            },
                        });
            const toolResult = await runChatTool('add_service', toolArgs, conversationId, {
                allowFaqs: true,
                language: responseLanguage,
                userMessage: autoMessage,
                userMessageId: visitorMessageId,
            });
                        await chatDeps.storage.addConversationMessage({
                            id: crypto.randomUUID(),
                            conversationId,
                            role: MESSAGE_ROLE.ASSISTANT,
                            content: `[TOOL RESULT] add_service`,
                            metadata: {
                                internal: true,
                                type: 'tool_result',
                                toolName: 'add_service',
                                toolResult,
                                toolCallId,
                            },
                        });
                    }

                    if (matchedServices.length > 0) {
                        const updatedConversation = await chatDeps.storage.getConversation(conversationId);
                        if (updatedConversation) {
                            const currentMemory = (updatedConversation.memory as any) || { collectedData: {}, completedSteps: [] };
                            currentMemory.autoAddedServiceIds = matchedServices.map((s) => s.id);
                            currentMemory.autoAddedServices = matchedServices.map((s) => normalizeServiceName(s.name || ''));
                            currentMemory.autoAddedMessageId = visitorMessageId;
                            await chatDeps.storage.updateConversation(conversationId, { memory: currentMemory });
                        }
                        conversation = await chatDeps.storage.getConversation(conversationId);
                    }
                } else {
                    console.log('[Chat AutoAdd] No recent add_service tool calls found, skipping auto-add');
                }
            } else {
                console.log('[Chat AutoAdd] Cart already has items, skipping auto-add safety net');
            }
        }

        // ✅ DEDUPLICATED: Auto-book when user confirms after a booking confirmation prompt
        let autoBookingResult: any = null;
        let autoBookingAttempted = false;
        let autoBookingFailureResult: any = null;
        let autoBookingFailureSuggestions: Array<{ date: string; availableSlots: string[] }> | null = null;
        if (shouldAutoBook) {
            autoBookingAttempted = true;
            const bookingAttempt = await attemptAutoBooking(conversationId, 'Creating booking on user confirmation', {
                allowFaqs: true,
                language: responseLanguage,
                userMessage: autoMessage,
                userMessageId: visitorMessageId,
            });

            if (bookingAttempt.success) {
                autoBookingResult = bookingAttempt.result;
                conversation = await chatDeps.storage.getConversation(conversationId);
            } else {
                autoBookingFailureResult = bookingAttempt.result;
                if (Array.isArray(bookingAttempt.result?.availableSlots) && bookingAttempt.result.availableSlots.length > 0) {
                    const memoryCollectedForFailure = ((conversation?.memory as any)?.collectedData || {}) as Record<string, any>;
                    const failedBookingDate = (bookingAttempt.result?.bookingDate || bookingAttempt.result?.booking_date || memoryCollectedForFailure.selectedDate || memoryCollectedForFailure.preferredDate) as string | undefined;
                    if (failedBookingDate && /^\d{4}-\d{2}-\d{2}$/.test(failedBookingDate)) {
                        autoBookingFailureSuggestions = [{
                            date: failedBookingDate,
                            availableSlots: bookingAttempt.result.availableSlots,
                        }];
                    }
                }
            }
        }

        const autoMemory = (conversation?.memory as any) || { collectedData: {}, completedSteps: [] };
        const autoCollected = autoMemory.collectedData || {};
        const autoCart = Array.isArray(autoMemory.cart) ? autoMemory.cart : [];
        const nextObjectiveForAuto = getNextIntakeObjective(enabledObjectives, conversation, autoCollected, autoCart);
        const parsedTime = parseTimeFromText(autoMessage);
        const explicitDateMatch = autoMessage.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
        const explicitDateFromMessage = explicitDateMatch ? explicitDateMatch[1] : null;
        const lastSuggestedDate = autoMemory.lastSuggestedDate;
        const lastSuggestedSlots = Array.isArray(autoMemory.lastSuggestedSlots) ? autoMemory.lastSuggestedSlots : [];
        const lastSuggestedOptions = Array.isArray(autoMemory.lastSuggestedOptions) ? autoMemory.lastSuggestedOptions : [];
        const persistSuggestedSlotContext = async (suggestions: any[]) => {
            if (!Array.isArray(suggestions) || suggestions.length === 0) return;
            const normalized = suggestions
                .map((item) => ({
                    date: typeof item?.date === 'string' ? item.date : '',
                    availableSlots: Array.isArray(item?.availableSlots)
                        ? item.availableSlots.filter((slot: any) => typeof slot === 'string')
                        : [],
                }))
                .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.availableSlots.length > 0);
            if (normalized.length === 0) return;

            const currentConv = await chatDeps.storage.getConversation(conversationId);
            const currentMem = (currentConv?.memory as any) || { collectedData: {}, completedSteps: [] };
            const primary = normalized[0];
            const updatedMemory = {
                ...currentMem,
                lastSuggestedDate: primary.date,
                lastSuggestedSlots: primary.availableSlots,
                lastSuggestedOptions: normalized.slice(0, 5),
            };
            await chatDeps.storage.updateConversation(conversationId, { memory: updatedMemory });
            conversation = await chatDeps.storage.getConversation(conversationId);
        };
        const runAutoUpdateContact = async (toolArgs: Record<string, any>) => {
            const toolCallId = crypto.randomUUID();
            await chatDeps.storage.addConversationMessage({
                id: crypto.randomUUID(),
                conversationId,
                role: MESSAGE_ROLE.ASSISTANT,
                content: `[TOOL CALL] update_contact`,
                metadata: {
                    internal: true,
                    type: 'tool_call',
                    toolName: 'update_contact',
                    toolArgs,
                    toolCallId,
                },
            });
            const toolResult = await runChatTool('update_contact', toolArgs, conversationId, {
                allowFaqs: true,
                language: responseLanguage,
                userMessage: autoMessage,
                userMessageId: visitorMessageId,
            });
            await chatDeps.storage.addConversationMessage({
                id: crypto.randomUUID(),
                conversationId,
                role: MESSAGE_ROLE.ASSISTANT,
                content: `[TOOL RESULT] update_contact`,
                metadata: {
                    internal: true,
                    type: 'tool_result',
                    toolName: 'update_contact',
                    toolResult,
                    toolCallId,
                },
            });
        };

        // Handle date/time selection when availability was shown
        if (nextObjectiveForAuto?.id === 'date' && parsedTime && (lastSuggestedDate || explicitDateFromMessage)) {
            const suggestedMatches = explicitDateFromMessage
                ? []
                : lastSuggestedOptions.filter((item: any) =>
                    item?.date &&
                    Array.isArray(item?.availableSlots) &&
                    item.availableSlots.includes(parsedTime)
                );
            const resolvedDate = explicitDateFromMessage ||
                (suggestedMatches.length === 1 ? suggestedMatches[0].date : null) ||
                (lastSuggestedSlots.length === 0 || lastSuggestedSlots.includes(parsedTime) ? lastSuggestedDate : null);

            if (resolvedDate) {
                const completedSteps = Array.isArray(autoMemory.completedSteps) ? autoMemory.completedSteps : [];
                const updatedMemory = {
                    ...autoMemory,
                    collectedData: {
                        ...autoCollected,
                        preferredDate: autoCollected.preferredDate || resolvedDate,
                        selectedDate: resolvedDate,
                        selectedTime: parsedTime,
                    },
                    completedSteps: completedSteps.includes('date') ? completedSteps : [...completedSteps, 'date'],
                    lastSuggestedDate: null,
                    lastSuggestedSlots: null,
                    lastSuggestedOptions: null,
                };
                await chatDeps.storage.updateConversation(conversationId, { memory: updatedMemory });
                await chatDeps.storage.addConversationMessage({
                    id: crypto.randomUUID(),
                    conversationId,
                    role: MESSAGE_ROLE.ASSISTANT,
                    content: `[INTAKE] Auto-captured time ${parsedTime} for ${resolvedDate}`,
                    metadata: {
                        internal: true,
                        type: 'intake_auto',
                        selectedTime: parsedTime,
                        selectedDate: resolvedDate,
                    },
                });
                conversation = await chatDeps.storage.getConversation(conversationId);
            }
        }

        if (nextObjectiveForAuto?.id === 'date' && !parsedTime && isAffirmative && lastSuggestedDate && lastSuggestedSlots.length > 0) {
            const assistantSuggestedTime = parseTimeFromText(lastAssistantMessage?.content || '');
            const suggestedMatches = assistantSuggestedTime
                ? lastSuggestedOptions.filter((item: any) =>
                    item?.date &&
                    Array.isArray(item?.availableSlots) &&
                    item.availableSlots.includes(assistantSuggestedTime)
                )
                : [];
            const resolvedDate =
                suggestedMatches.length === 1
                    ? suggestedMatches[0].date
                    : (assistantSuggestedTime && lastSuggestedSlots.includes(assistantSuggestedTime) ? lastSuggestedDate : null);

            if (assistantSuggestedTime && resolvedDate) {
                const completedSteps = Array.isArray(autoMemory.completedSteps) ? autoMemory.completedSteps : [];
                const updatedMemory = {
                    ...autoMemory,
                    collectedData: {
                        ...autoCollected,
                        preferredDate: autoCollected.preferredDate || resolvedDate,
                        selectedDate: resolvedDate,
                        selectedTime: assistantSuggestedTime,
                    },
                    completedSteps: completedSteps.includes('date') ? completedSteps : [...completedSteps, 'date'],
                    lastSuggestedDate: null,
                    lastSuggestedSlots: null,
                    lastSuggestedOptions: null,
                };
                await chatDeps.storage.updateConversation(conversationId, { memory: updatedMemory });
                await chatDeps.storage.addConversationMessage({
                    id: crypto.randomUUID(),
                    conversationId,
                    role: MESSAGE_ROLE.ASSISTANT,
                    content: `[INTAKE] Auto-selected confirmed slot ${assistantSuggestedTime} for ${resolvedDate} after affirmative reply`,
                    metadata: {
                        internal: true,
                        type: 'intake_auto',
                        selectedTime: assistantSuggestedTime,
                        selectedDate: resolvedDate,
                        inferredFromAffirmative: true,
                    },
                });
                conversation = await chatDeps.storage.getConversation(conversationId);
            }
        }

        // Always try to capture out-of-order inputs
        const currentMemoryForCapture = (conversation?.memory as any) || { collectedData: {}, completedSteps: [] };
        const currentCollectedForCapture = currentMemoryForCapture.collectedData || {};
        const currentStepsForCapture = Array.isArray(currentMemoryForCapture.completedSteps) ? currentMemoryForCapture.completedSteps : [];
        const captureMemoryUpdates: Record<string, string> = {};
        const captureContactUpdates: Record<string, string> = {};
        const capturedFields: string[] = [];
        const completedStepsSet = new Set<string>(currentStepsForCapture);

        // Capture zipcode
        if (!completedStepsSet.has('zipcode') && !currentCollectedForCapture.zipcode) {
            const zipcode = parseZipFromText(autoMessage);
            if (zipcode) {
                captureMemoryUpdates.zipcode = zipcode;
                completedStepsSet.add('zipcode');
                capturedFields.push(`zipcode:${zipcode}`);
            }
        }

        // Capture name (supports explicit patterns like "my name is Carlos")
        const hasEnoughHistory = existingMessages.filter((m: any) => !(m.metadata as any)?.internal).length >= AUTO_CAPTURE.MIN_HISTORY_FOR_NAME;
        if (!completedStepsSet.has('name') && !currentCollectedForCapture.name) {
            const parsedName = parseNameFromText(autoMessage);
            const fallbackName = hasEnoughHistory &&
                nextObjectiveForAuto?.id === 'name' &&
                looksLikeName(autoMessage) &&
                !parsePhoneFromText(autoMessage) &&
                !looksLikeAddress(autoMessage)
                ? autoMessage.trim()
                : null;
            const name = parsedName || fallbackName;
            if (name) {
                captureMemoryUpdates.name = name;
                captureContactUpdates.name = name;
                completedStepsSet.add('name');
                capturedFields.push(`name:${name}`);
            }
        }

        // Capture phone
        let capturedPhone: string | null = null;
        if (!completedStepsSet.has('phone') && !currentCollectedForCapture.phone) {
            const phone = parsePhoneFromText(autoMessage);
            if (phone) {
                captureMemoryUpdates.phone = phone;
                captureContactUpdates.phone = phone;
                completedStepsSet.add('phone');
                capturedFields.push(`phone:${phone}`);
                capturedPhone = phone;
            }
        }

        // Capture address
        if (!completedStepsSet.has('address') && !currentCollectedForCapture.address) {
            const extractedAddress = parseAddressFromText(autoMessage);
            if (extractedAddress || looksLikeAddress(autoMessage)) {
                const cleanAddress = extractedAddress || autoMessage.trim();
                captureMemoryUpdates.address = cleanAddress;
                completedStepsSet.add('address');
                capturedFields.push('address');
            }
        }

        if (Object.keys(captureMemoryUpdates).length > 0) {
            const mergedCollected = {
                ...currentCollectedForCapture,
                ...captureMemoryUpdates,
            };
            const mergedMemory = {
                ...currentMemoryForCapture,
                collectedData: mergedCollected,
                completedSteps: Array.from(completedStepsSet),
            };

            const conversationUpdates: any = {
                memory: mergedMemory,
            };
            if (captureMemoryUpdates.zipcode) conversationUpdates.visitorZipcode = captureMemoryUpdates.zipcode;
            if (captureMemoryUpdates.address) conversationUpdates.visitorAddress = captureMemoryUpdates.address;
            if (captureMemoryUpdates.name) conversationUpdates.visitorName = captureMemoryUpdates.name;
            if (captureMemoryUpdates.phone) conversationUpdates.visitorPhone = captureMemoryUpdates.phone;

            await chatDeps.storage.updateConversation(conversationId, conversationUpdates);

            await chatDeps.storage.addConversationMessage({
                id: crypto.randomUUID(),
                conversationId,
                role: MESSAGE_ROLE.ASSISTANT,
                content: `[INTAKE] Auto-captured: ${capturedFields.join(', ')}`,
                metadata: {
                    internal: true,
                    type: 'intake_auto',
                    captured: captureMemoryUpdates,
                },
            });

            if (Object.keys(captureContactUpdates).length > 0) {
                await runAutoUpdateContact(captureContactUpdates);
                autoLeadCaptured = true;
            }

            conversation = await chatDeps.storage.getConversation(conversationId);
        }

        if (capturedPhone) {
            const existingConv = await chatDeps.storage.findOpenConversationByContact(capturedPhone, undefined, conversationId);
            if (existingConv) {
                console.log(`[Chat Dedup] Found existing open conversation ${existingConv.id} for phone ${capturedPhone}, closing it in favor of current ${conversationId}`);
                await chatDeps.storage.updateConversation(existingConv.id, { status: CONVERSATION_STATUS.CLOSED });
                await chatDeps.storage.addConversationMessage({
                    id: crypto.randomUUID(),
                    conversationId: existingConv.id,
                    role: MESSAGE_ROLE.ASSISTANT,
                    content: `[SYSTEM] Conversation closed: customer started a new conversation (${conversationId})`,
                    metadata: { internal: true, type: 'dedup', newConversationId: conversationId },
                });
            }
        }

        const company = await chatDeps.storage.getCompanySettings();
        const history = await chatDeps.storage.getConversationMessages(conversationId);
        const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = history
            .filter((m) => !(m.metadata as any)?.internal)
            .slice(-24)
            .map((m) => ({
                role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
                content: m.content,
            }));

        // Build intake flow description
        const intakeFlowText = enabledObjectives.length
            ? enabledObjectives.map((o, idx) => `${idx + 1}. ${o.label}`).join('\n')
            : '1. Service type\n2. Preferred date\n3. Name\n4. Phone\n5. Address';

        // Load conversation memory
        const conversationMemory = (conversation?.memory as any) || { collectedData: {}, completedSteps: [] };
        const collectedData = conversationMemory.collectedData || {};
        const completedSteps = conversationMemory.completedSteps || [];
        const selectedService = conversationMemory.selectedService;
        const cart = Array.isArray(conversationMemory.cart) ? conversationMemory.cart : [];
        const cartSummary = cart.length
            ? cart.map((item: any) => {
                const qty = Number(item.quantity) || 1;
                const lineTotal = Number(item.price) || 0;
                return `${item.serviceName || 'Service'} x ${qty} ($${lineTotal})`;
            }).join(', ')
            : 'Empty';

        const nextObjective = getNextIntakeObjective(enabledObjectives, conversation, collectedData, cart);

        // Detect repetition
        let stepRepeatCount = 0;
        if (nextObjective) {
            const recentIntakeMessages = existingMessages
                .filter((m: any) => m.metadata?.type === 'intake_next')
                .slice(-5);
            for (let i = recentIntakeMessages.length - 1; i >= 0; i--) {
                if ((recentIntakeMessages[i].metadata as any)?.nextStep?.id === nextObjective.id) {
                    stepRepeatCount++;
                } else {
                    break;
                }
            }
        }

        let intakeEnforcement: string;
        if (!nextObjective) {
            intakeEnforcement = 'All intake steps complete.';
        } else if (userAskedDirectQuestion) {
            intakeEnforcement = `NEXT REQUIRED STEP: ${nextObjective.label} (${nextObjective.id}). The user asked a direct question in this turn. Answer their question first with concrete information and only then ask for the next intake step.`;
        } else if (stepRepeatCount >= 3) {
            intakeEnforcement = `NEXT REQUIRED STEP: ${nextObjective.label} (${nextObjective.id}). IMPORTANT: You have already asked for this ${stepRepeatCount} times. The customer may not have this info right now. Acknowledge what they said, try rephrasing your question differently, or offer to skip this step and come back to it later. Do NOT repeat the same question verbatim.`;
        } else if (stepRepeatCount >= 1) {
            intakeEnforcement = `NEXT REQUIRED STEP: ${nextObjective.label} (${nextObjective.id}). Note: you already asked for this. If the user provided something else, acknowledge it and gently ask again in a different way. If the user already provided it, call update_memory with completed_step and move to the next step.`;
        } else {
            intakeEnforcement = `NEXT REQUIRED STEP: ${nextObjective.label} (${nextObjective.id}). Ask ONLY for this step next. Do NOT ask about later steps. If the user asks a direct question outside the intake flow, answer it first using company info or FAQ data, then return to this step. If the user already provided it, call update_memory with completed_step and move to the next step.`;
        }
        if (conversationId) {
            await chatDeps.storage.addConversationMessage({
                id: crypto.randomUUID(),
                conversationId,
                role: MESSAGE_ROLE.ASSISTANT,
                content: `[INTAKE] Next step: ${nextObjective ? `${nextObjective.label} (${nextObjective.id})` : 'None'}`,
                metadata: {
                    internal: true,
                    type: 'intake_next',
                    nextStep: nextObjective ? { id: nextObjective.id, label: nextObjective.label } : null,
                    completedSteps,
                },
            });
        }

        const memoryContext = `
CONVERSATION STATE (from memory):
${selectedService ? `• Selected service: ${selectedService.name} ($${selectedService.price}) - ID: ${selectedService.id}` : '• No service selected yet'}
• Cart: ${cartSummary}
${collectedData.zipcode ? `• ZIP code: ${collectedData.zipcode}` : ''}
${collectedData.serviceType ? `• Service type: ${collectedData.serviceType}` : ''}
${collectedData.serviceDetails ? `• Service details: ${collectedData.serviceDetails}` : ''}
${collectedData.preferredDate ? `• Preferred date: ${collectedData.preferredDate}` : ''}
${collectedData.selectedDate ? `• Confirmed date: ${collectedData.selectedDate}` : ''}
${collectedData.selectedTime ? `• Confirmed time: ${collectedData.selectedTime}` : ''}
${collectedData.name ? `• Name: ${collectedData.name}` : ''}
${collectedData.phone ? `• Phone: ${collectedData.phone}` : ''}
${collectedData.email ? `• Email: ${collectedData.email}` : ''}
${collectedData.address ? `• Address: ${collectedData.address}` : ''}
${completedSteps.length > 0 ? `• Completed steps: ${completedSteps.join(', ')}` : '• No steps completed yet'}
`.trim();

        const timeZone = company?.timeZone || 'America/New_York';
        const nowForPrompt = new Date();
        const tzFormatterFull = new Intl.DateTimeFormat('en-US', {
            timeZone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const currentDateTimeEST = tzFormatterFull.format(nowForPrompt);
        const currentDateISO = getTodayStr(new Date(), timeZone);

        const allowFaqs = true;
        const languageInstruction = responseLanguage
            ? `Respond in ${responseLanguage}.`
            : '';

        const companyName = (company?.companyName || 'the business').trim();
        const rawIndustry = (company?.industry || '').trim();
        const industryLabel = rawIndustry
            ? rawIndustry
                .split(' ')
                .filter(Boolean)
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ')
            : '';
        const industryLine = industryLabel ? `Business type: ${industryLabel}.` : '';
        const companyInfoSummary = [
            company?.companyName ? `Company: ${company.companyName}` : null,
            company?.companyPhone ? `Phone: ${company.companyPhone}` : null,
            company?.companyEmail ? `Email: ${company.companyEmail}` : null,
            company?.companyAddress ? `Address: ${company.companyAddress}` : null,
            company?.timeZone ? `Time zone: ${company.timeZone}` : null,
            company?.businessHours ? `Business hours: ${formatBusinessHoursSummary(company.businessHours as BusinessHours)}` : null,
        ]
            .filter(Boolean)
            .join('\n');

        const requiredFieldsList = ['service_id(s)', 'booking_date', 'start_time'];
        if (enabledObjectives.find(o => o.id === 'name')) requiredFieldsList.push('customer_name');
        if (enabledObjectives.find(o => o.id === 'phone')) requiredFieldsList.push('customer_phone');
        if (enabledObjectives.find(o => o.id === 'address')) requiredFieldsList.push('customer_address');

        let systemPrompt = CHAT_PROMPT_TEMPLATE
            .replace(/\{\{companyName\}\}/g, companyName)
            .replace(/\{\{industryLine\}\}/g, industryLine)
            .replace(/\{\{currentDateTimeEST\}\}/g, currentDateTimeEST)
            .replace(/\{\{currentDateISO\}\}/g, currentDateISO)
            .replace(/\{\{timeZone\}\}/g, timeZone)
            .replace(/\{\{intakeFlowText\}\}/g, intakeFlowText)
            .replace(/\{\{requiredFieldsList\}\}/g, requiredFieldsList.join(', '))
            .replace(/\{\{languageInstruction\}\}/g, languageInstruction);

        const dynamicChatTools = buildChatTools(enabledObjectives);

        const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: MESSAGE_ROLE.SYSTEM, content: systemPrompt },
            { role: MESSAGE_ROLE.SYSTEM, content: companyInfoSummary ? `BUSINESS INFO (use this to answer questions):\n${companyInfoSummary}` : 'BUSINESS INFO: Not available.' },
            { role: MESSAGE_ROLE.SYSTEM, content: memoryContext },
            { role: MESSAGE_ROLE.SYSTEM, content: intakeEnforcement },
            ...historyMessages,
        ];

        const aiClient = activeProvider === "gemini"
            ? chatDeps.getGeminiClient(apiKey)
            : activeProvider === "openrouter"
                ? chatDeps.getOpenRouterClient(apiKey)
                : chatDeps.getOpenAIClient(apiKey);
        if (!aiClient) {
            return res.status(503).json({ message: 'Chat is currently unavailable.' });
        }

        // Shared variables for downstream logic
        const DEFAULT_ASSISTANT_FALLBACK = 'Sorry, I could not process that request.';
        let assistantResponse = DEFAULT_ASSISTANT_FALLBACK;
        let leadCaptured = autoLeadCaptured;
        let bookingCompleted: { value: number; services: string[] } | null = null;
        let bookingAttempted = autoBookingAttempted;
        let bookingFailed = autoBookingAttempted && !!autoBookingFailureResult;
        let bookingFailureSuggestions: Array<{ date: string; availableSlots: string[] }> | null = autoBookingFailureSuggestions;
        const toolCallNames: string[] = [];

        if (autoBookingResult?.success) {
            bookingAttempted = true;
            bookingCompleted = {
                value: parseFloat(String(autoBookingResult.totalPrice ?? '0')) || 0,
                services: autoBookingResult.services?.map((s: any) => s.name) || []
            };
            const serviceSummary = bookingCompleted.services.join(', ') || 'your service';
            const bookingDate = autoBookingResult.bookingDate || 'your scheduled date';
            const bookingTime = autoBookingResult.startTime || '';
            assistantResponse = `You're all set! ${serviceSummary} booked for ${bookingDate}${bookingTime ? ' at ' + bookingTime : ''}. You'll get a text confirmation.`;
            console.log('[Chat] Auto-booking succeeded in pre-processing, using confirmation response');
        }

        if (autoBookingAttempted && !autoBookingResult?.success) {
            if (bookingFailureSuggestions && bookingFailureSuggestions.length > 0) {
                assistantResponse = `That time is no longer available. ${formatAvailabilityResponse(bookingFailureSuggestions)}`;
            } else if (autoBookingFailureResult?.userMessage) {
                assistantResponse = autoBookingFailureResult.userMessage;
            } else if (autoBookingFailureResult?.error) {
                assistantResponse = `Sorry, I couldn't complete your booking: ${autoBookingFailureResult.error}`;
            }
        }

        if (!autoBookingResult?.success && !autoBookingAttempted) {
            try {
                const firstReq: any = {
                    model,
                    messages: chatMessages,
                    tools: dynamicChatTools,
                    tool_choice: 'auto',
                };
                if (activeProvider === 'openai') {
                    firstReq.max_completion_tokens = OPENAI_CONFIG.MAX_COMPLETION_TOKENS;
                    firstReq.parallel_tool_calls = true;
                } else {
                    // Gemini OpenAI-compatible endpoint may not accept `max_completion_tokens` / `parallel_tool_calls`.
                    firstReq.max_tokens = OPENAI_CONFIG.MAX_COMPLETION_TOKENS;
                }

                const first = await aiClient.chat.completions.create(firstReq);

                let choice = first.choices[0].message;
                const toolCalls = choice.tool_calls || [];
                toolCallNames.push(...toolCalls.map((call) => call.function.name));
                const toolOutcomes: Array<{ name: string; result: any }> = [];

                let postToolNextObjective = nextObjective;

                if (toolCalls.length > 0) {
                    const toolResponses = [];
                    for (const call of toolCalls) {
                        let args: any = {};
                        try {
                            args = JSON.parse(call.function.arguments || '{}');
                        } catch {
                            args = {};
                        }

                        await chatDeps.storage.addConversationMessage({
                            id: crypto.randomUUID(),
                            conversationId,
                            role: MESSAGE_ROLE.ASSISTANT,
                            content: `[TOOL CALL] ${call.function.name}`,
                            metadata: {
                                internal: true,
                                type: 'tool_call',
                                toolName: call.function.name,
                                toolArgs: args,
                                toolCallId: call.id,
                            },
                        });

                        let toolResult: any;
                        if (call.function.name === 'create_booking' && !shouldAutoBook) {
                            toolResult = {
                                success: false,
                                error: 'Final confirmation required before booking.',
                                userMessage: 'Show the booking summary and wait for the customer to confirm before creating the booking.',
                            };
                        }

                        if (call.function.name === 'add_service' && shouldAutoAddServices) {
                            const liveConversationForAdd = await chatDeps.storage.getConversation(conversationId);
                            const liveMemoryForAdd = (liveConversationForAdd?.memory as any) || {};
                            const liveCartForAdd = Array.isArray(liveMemoryForAdd.cart) ? liveMemoryForAdd.cart : [];
                            const requestedServiceId = Number(args?.service_id) || 0;
                            const requestedServiceName = typeof args?.service_name === 'string'
                                ? normalizeServiceName(args.service_name)
                                : '';
                            const alreadyInCart = liveCartForAdd.some((item: any) => {
                                const cartServiceId = Number(item?.serviceId) || 0;
                                const cartServiceName = normalizeServiceName(item?.serviceName || '');
                                return (
                                    (requestedServiceId > 0 && cartServiceId === requestedServiceId) ||
                                    (!!requestedServiceName && cartServiceName === requestedServiceName)
                                );
                            });

                            if (alreadyInCart) {
                                toolResult = {
                                    success: true,
                                    deduplicated: true,
                                    cart: liveCartForAdd,
                                    total: liveCartForAdd.reduce((sum: number, item: any) => sum + Number(item?.price || 0), 0),
                                    message: 'Service already in cart.',
                                };
                            }
                        }

                        if (!toolResult) {
                            toolResult = await runChatTool(call.function.name, args, conversationId, {
                                allowFaqs,
                                language: responseLanguage,
                                userMessage: input.message,
                                userMessageId: visitorMessageId,
                            });
                        }

                        await chatDeps.storage.addConversationMessage({
                            id: crypto.randomUUID(),
                            conversationId,
                            role: MESSAGE_ROLE.ASSISTANT,
                            content: `[TOOL RESULT] ${call.function.name}`,
                            metadata: {
                                internal: true,
                                type: 'tool_result',
                                toolName: call.function.name,
                                toolResult: toolResult,
                                toolCallId: call.id,
                            },
                        });

                        if (call.function.name === 'update_contact' && toolResult.success) {
                            const conv = await chatDeps.storage.getConversation(conversationId);
                            if (conv?.visitorName || conv?.visitorEmail || conv?.visitorPhone) {
                                leadCaptured = true;
                            }
                        }

                        if (call.function.name === 'create_booking') {
                            bookingAttempted = true;
                            if (toolResult.success) {
                                bookingCompleted = {
                                    value: parseFloat(String(toolResult.totalPrice ?? '0')) || 0,
                                    services: toolResult.services?.map((s: any) => s.name) || []
                                };
                            } else {
                                bookingFailed = true;
                                if (Array.isArray(toolResult.availableSlots) && toolResult.availableSlots.length > 0) {
                                    const bookingDateFromArgs = typeof args?.booking_date === 'string' ? args.booking_date : null;
                                    if (bookingDateFromArgs && /^\d{4}-\d{2}-\d{2}$/.test(bookingDateFromArgs)) {
                                        bookingFailureSuggestions = [{
                                            date: bookingDateFromArgs,
                                            availableSlots: toolResult.availableSlots,
                                        }];
                                        await persistSuggestedSlotContext([{
                                            date: bookingDateFromArgs,
                                            availableSlots: toolResult.availableSlots,
                                        }]);
                                    }
                                }
                                console.log('[Chat] Booking failed:', {
                                    conversationId,
                                    error: toolResult.error,
                                    userMessage: toolResult.userMessage
                                });
                            }
                        }

                        if (call.function.name === 'suggest_booking_dates' && toolResult.success && Array.isArray(toolResult.suggestions)) {
                            (toolResponses as any).availabilitySuggestions = toolResult.suggestions;
                            await persistSuggestedSlotContext(toolResult.suggestions);
                        }

                        toolOutcomes.push({ name: call.function.name, result: toolResult });
                        toolResponses.push({
                            role: 'tool' as const,
                            tool_call_id: call.id,
                            content: JSON.stringify(toolResult),
                        });
                    }

                    const cleanedChoice = {
                        ...choice,
                        content: null,
                    };

                    const secondReq: any = {
                        model,
                        messages: [...chatMessages, cleanedChoice, ...toolResponses],
                    };
                    if (activeProvider === 'openai') {
                        secondReq.max_completion_tokens = OPENAI_CONFIG.MAX_COMPLETION_TOKENS;
                    } else {
                        secondReq.max_tokens = OPENAI_CONFIG.MAX_COMPLETION_TOKENS;
                    }

                    const second = await aiClient.chat.completions.create(secondReq);

                    assistantResponse = second.choices[0].message.content?.trim() || '';
                    assistantResponse = sanitizeAssistantResponse(assistantResponse);

                    const availabilitySuggestions = (toolResponses as any).availabilitySuggestions;
                    if (toolCallNames.includes('suggest_booking_dates') && availabilitySuggestions && availabilitySuggestions.length > 0) {
                        const hasTimeInResponse = /\d+\s*(am|pm)|:\d{2}/.test(assistantResponse.toLowerCase());
                        if (!hasTimeInResponse) {
                            assistantResponse = formatAvailabilityResponse(availabilitySuggestions);
                        }
                    }

                    if (!assistantResponse.trim() || assistantResponse === DEFAULT_ASSISTANT_FALLBACK) {
                        const latestSuccessfulSuggestions = [...toolOutcomes]
                            .reverse()
                            .find((outcome) =>
                                outcome.name === 'suggest_booking_dates' &&
                                Array.isArray(outcome.result?.suggestions) &&
                                outcome.result.suggestions.length > 0
                            );
                        if (latestSuccessfulSuggestions) {
                            assistantResponse = formatAvailabilityResponse(latestSuccessfulSuggestions.result.suggestions);
                        } else {
                            const nonDedupAdd = [...toolOutcomes]
                                .reverse()
                                .find((outcome) =>
                                    outcome.name === 'add_service' &&
                                    outcome.result?.success === true &&
                                    !outcome.result?.deduplicated &&
                                    typeof outcome.result?.message === 'string'
                                );
                            const fallbackAdd = [...toolOutcomes]
                                .reverse()
                                .find((outcome) =>
                                    outcome.name === 'add_service' &&
                                    outcome.result?.success === true &&
                                    typeof outcome.result?.message === 'string'
                                );
                            if (nonDedupAdd?.result?.message) {
                                assistantResponse = nonDedupAdd.result.message;
                            } else if (fallbackAdd?.result?.message) {
                                assistantResponse = fallbackAdd.result.message;
                            }
                        }
                    }

                    const latestServiceClarification = [...toolOutcomes]
                        .reverse()
                        .find((outcome) =>
                            outcome.name === 'list_services' &&
                            typeof outcome.result?.clarificationQuestion === 'string' &&
                            outcome.result.clarificationQuestion.trim()
                        );

                    if (latestServiceClarification && !toolCallNames.includes('add_service')) {
                        assistantResponse = latestServiceClarification.result.clarificationQuestion.trim();
                    }
                } else {
                    assistantResponse = choice.content?.trim() || '';
                    assistantResponse = sanitizeAssistantResponse(assistantResponse);
                }

                if (toolCalls.length > 0) {
                    const refreshedConversation = await chatDeps.storage.getConversation(conversationId);
                    const refreshedMemory = (refreshedConversation?.memory as any) || { collectedData: {}, completedSteps: [] };
                    const refreshedCollected = refreshedMemory.collectedData || {};
                    const refreshedCart = Array.isArray(refreshedMemory.cart) ? refreshedMemory.cart : [];
                    postToolNextObjective = getNextIntakeObjective(
                        enabledObjectives,
                        refreshedConversation,
                        refreshedCollected,
                        refreshedCart
                    );
                }

                if (postToolNextObjective?.id === 'date' && !toolCallNames.includes('suggest_booking_dates')) {
                    const inferredDate = parseRelativeDateFromText(input.message, currentDateISO);
                    const windowHint = detectDateWindowFromText(input.message);
                    if (inferredDate || windowHint) {
                        const liveConversation = await chatDeps.storage.getConversation(conversationId);
                        const liveMemory = (liveConversation?.memory as any) || { collectedData: {} };
                        const liveCart = Array.isArray(liveMemory.cart) ? liveMemory.cart : [];
                        const fallbackServiceId =
                            Number(liveCart?.[0]?.serviceId) ||
                            Number(liveMemory?.selectedService?.id) ||
                            0;

                        if (!fallbackServiceId) {
                            await chatDeps.storage.addConversationMessage({
                                id: crypto.randomUUID(),
                                conversationId,
                                role: MESSAGE_ROLE.ASSISTANT,
                                content: `[DEBUG] Skipping suggest_booking_dates fallback: missing service_id`,
                                metadata: {
                                    internal: true,
                                    type: 'debug',
                                    reason: 'missing_service_id_for_date_fallback',
                                },
                            });
                        } else {
                            const toolArgs: any = { service_id: fallbackServiceId };
                            if (inferredDate) {
                                toolArgs.specific_date = inferredDate;
                            } else if (windowHint) {
                                const hintedDate = new Date(`${currentDateISO}T12:00:00`);
                                hintedDate.setDate(hintedDate.getDate() + windowHint.startOffsetDays);
                                toolArgs.specific_date = hintedDate.toISOString().split('T')[0];
                                toolArgs.max_suggestions = windowHint.maxSuggestions;
                            }
                        const toolCallId = crypto.randomUUID();
                        await chatDeps.storage.addConversationMessage({
                            id: crypto.randomUUID(),
                            conversationId,
                            role: MESSAGE_ROLE.ASSISTANT,
                            content: `[TOOL CALL] suggest_booking_dates`,
                            metadata: {
                                internal: true,
                                type: 'tool_call',
                                toolName: 'suggest_booking_dates',
                                toolArgs,
                                toolCallId,
                            },
                        });
                        const toolResult = await runChatTool('suggest_booking_dates', toolArgs, conversationId, {
                            allowFaqs,
                            language: responseLanguage,
                            userMessage: input.message,
                            userMessageId: visitorMessageId,
                        });
                        await chatDeps.storage.addConversationMessage({
                            id: crypto.randomUUID(),
                            conversationId,
                            role: MESSAGE_ROLE.ASSISTANT,
                            content: `[TOOL RESULT] suggest_booking_dates`,
                            metadata: {
                                internal: true,
                                type: 'tool_result',
                                toolName: 'suggest_booking_dates',
                                toolResult,
                                toolCallId,
                            },
                        });
                        if (toolResult?.success && Array.isArray(toolResult.suggestions) && (toolResult.suggestions as any[]).length > 0) {
                            assistantResponse = formatAvailabilityResponse(toolResult.suggestions);
                            toolCallNames.push('suggest_booking_dates');
                            await persistSuggestedSlotContext(toolResult.suggestions);
                        }
                        }
                    }
                }

                if (!autoBookingResult && isAffirmative && !bookingAttempted && isBookingConfirm) {
                    const bookingAttempt = await attemptAutoBooking(conversationId, 'Affirmative response with complete booking data', {
                        allowFaqs,
                        language: responseLanguage,
                        userMessage: input.message,
                        userMessageId: visitorMessageId,
                    });
                    if (bookingAttempt.success) {
                        autoBookingResult = bookingAttempt.result;
                        bookingAttempted = true;
                        bookingCompleted = bookingAttempt.bookingCompleted || null;
                        const serviceSummary = bookingCompleted?.services?.join(', ') || 'your service';
                        const bookingDate = autoBookingResult.bookingDate || 'your scheduled date';
                        const bookingTime = autoBookingResult.startTime || '';
                        assistantResponse = `You're all set! ${serviceSummary} booked for ${bookingDate}${bookingTime ? ' at ' + bookingTime : ''}. You'll get a text confirmation.`;
                    }
                }

                if (!postToolNextObjective && !bookingAttempted && !bookingCompleted && !isBookingConfirm) {
                    const finalSummary = await buildFinalBookingSummary(conversationId);
                    if (finalSummary) {
                        assistantResponse = finalSummary;
                    }
                }

                if (postToolNextObjective) {
                    const shouldEnforce = !userAskedDirectQuestion && !toolCallNames.some((name) =>
                        ['search_faqs', 'get_business_policies', 'suggest_booking_dates', 'create_booking', 'list_services', 'get_service_details'].includes(name)
                    );
                    if (shouldEnforce && !responseMentionsObjective(assistantResponse, postToolNextObjective.id)) {
                        const intakeQuestion = getIntakeQuestion(postToolNextObjective.id, responseLanguage);
                        const hasQuestionAlready = assistantResponse.includes('?');
                        const isDefaultFallbackResponse = assistantResponse.trim() === DEFAULT_ASSISTANT_FALLBACK;
                        if (!assistantResponse.trim() || isDefaultFallbackResponse) {
                            assistantResponse = intakeQuestion;
                        } else if (hasQuestionAlready) {
                            const nonQuestionSentences = (assistantResponse.match(/[^.!?]+[.!?]*/g) || [])
                                .filter((part) => !part.includes('?'))
                                .filter((part) => !/\b(sorry|apologize|mistake)\b/i.test(part))
                                .join(' ')
                                .replace(/\s+/g, ' ')
                                .trim();
                            assistantResponse = nonQuestionSentences
                                ? `${nonQuestionSentences} ${intakeQuestion}`.trim()
                                : intakeQuestion;
                        } else if (!hasQuestionAlready) {
                            // Keep intake as a guide: preserve useful response and add a gentle follow-up.
                            assistantResponse = `${assistantResponse.trim()} ${intakeQuestion}`.trim();
                        }
                    }
                }

                if (bookingAttempted && bookingFailed && !bookingCompleted) {
                    const successIndicators = [
                        'confirmado', 'confirmed', 'agendado', 'booked', 'scheduled', 'reservado',
                        'seu agendamento', 'your booking', 'your appointment', 'marcado'
                    ];
                    const responseLC = assistantResponse.toLowerCase();
                    const soundsLikeSuccess = successIndicators.some(word => responseLC.includes(word));

                    if (soundsLikeSuccess) {
                        console.error('[Chat] SAFETY NET TRIGGERED: AI response suggests success but booking failed', {
                            conversationId,
                            originalResponse: assistantResponse.substring(0, 200),
                        });
                        if (bookingFailureSuggestions && bookingFailureSuggestions.length > 0) {
                            assistantResponse = `That time is no longer available. ${formatAvailabilityResponse(bookingFailureSuggestions)}`;
                        } else {
                            assistantResponse = 'Sorry, there was a problem processing your booking. Please try again or contact us by phone.';
                        }
                    }
                }

                if (!bookingAttempted && !bookingCompleted) {
                    const successIndicators = [
                        'you\'re all set', 'all set', 'booking is confirmed', 'booked for', 'scheduled for',
                        'confirmado', 'agendado', 'marcado para', 'your appointment is', 'successfully booked',
                        'you\'ll get a text confirmation', 'text confirmation'
                    ];
                    const responseLC = assistantResponse.toLowerCase();
                    const soundsLikeSuccess = successIndicators.some(word => responseLC.includes(word));
                    const isAskingForBookingConfirmation = isBookingConfirmationPrompt(assistantResponse);

                    if (soundsLikeSuccess && !isAskingForBookingConfirmation) {
                        console.error('[Chat] CRITICAL SAFETY NET: AI fabricated booking confirmation without calling create_booking', {
                            conversationId,
                            originalResponse: assistantResponse.substring(0, 200),
                        });

                        // ✅ DEDUPLICATED: Use helper function for auto-booking
                        const bookingAttempt = await attemptAutoBooking(conversationId, 'AI fabricated confirmation without calling create_booking', {
                            allowFaqs,
                            language: responseLanguage,
                            userMessage: input.message,
                            userMessageId: visitorMessageId,
                        });

                        if (bookingAttempt.success) {
                            bookingCompleted = bookingAttempt.bookingCompleted;
                            console.log('[Chat] Auto-booking succeeded:', bookingCompleted);
                        } else if (bookingAttempt.result) {
                            // Booking was attempted but failed
                            console.error('[Chat] Auto-booking failed:', bookingAttempt.result.error);
                            assistantResponse = `Sorry, I couldn't complete your booking: ${bookingAttempt.result.error || 'Please try again.'}`;
                        } else {
                            // Missing required fields
                            assistantResponse = `Before I can confirm your booking, I still need some information. Could you provide that?`;
                        }
                    }
                }
            } catch (err: any) {
                console.error('OpenAI chat error:', err?.message);
                assistantResponse = 'Chat is unavailable right now. Please try again soon.';
            }
        }

        const assistantMessageId = crypto.randomUUID();
        if (!assistantResponse.trim()) {
            assistantResponse = DEFAULT_ASSISTANT_FALLBACK;
        }
        const createdAssistantMessage = await chatDeps.storage.addConversationMessage({
            id: assistantMessageId,
            conversationId,
            role: MESSAGE_ROLE.ASSISTANT,
            content: assistantResponse,
        });
        await chatDeps.storage.updateConversation(conversationId, { lastMessageAt: new Date() });

        const updatedConversation = await chatDeps.storage.getConversation(conversationId);
        conversationEvents.emit('new_message', {
            type: 'new_message',
            conversationId,
            message: createdAssistantMessage,
            conversation: updatedConversation,
        });

        res.json({
            conversationId,
            response: assistantResponse,
            leadCaptured,
            bookingCompleted
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
}
