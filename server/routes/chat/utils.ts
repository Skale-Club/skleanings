import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DEFAULT_CHAT_MODEL } from "../../lib/openai";
import { type BusinessHours, type Service, type ServiceOption, type ServiceFrequency, type PriceBreakdown, type BookingItemOption, type BookingItemFrequency, type AreaSizePreset, type CartItemData } from "@shared/schema";

// Get __dirname - works in both ESM and CJS (bundled)
function getDirname() {
    // @ts-ignore - In CJS bundle, __dirname is available as global
    if (typeof __dirname !== 'undefined') return __dirname;
    // In native ESM, use import.meta
    return path.dirname(fileURLToPath(import.meta.url));
}
const currentDir = getDirname();

export { DEFAULT_CHAT_MODEL };

export const urlRuleSchema = z.object({
    pattern: z.string().min(1),
    match: z.enum(['contains', 'starts_with', 'equals']),
});

export type UrlRule = z.infer<typeof urlRuleSchema>;

export type IntakeObjective = {
    id: 'zipcode' | 'name' | 'phone' | 'serviceType' | 'serviceDetails' | 'date' | 'address';
    label: string;
    description: string;
    enabled: boolean;
};

export const DEFAULT_INTAKE_OBJECTIVES: IntakeObjective[] = [
    { id: 'serviceType', label: 'Service type', description: 'Which service is requested', enabled: true },
    { id: 'serviceDetails', label: 'Service details', description: 'Extra details (size, options, notes)', enabled: true },
    { id: 'zipcode', label: 'Zip code', description: 'Collect ZIP code to validate service area', enabled: true },
    { id: 'date', label: 'Preferred date', description: 'Ask for a preferred date before showing availability', enabled: true },
    { id: 'name', label: 'Name', description: 'Customer full name', enabled: true },
    { id: 'phone', label: 'Phone', description: 'Phone number for confirmations', enabled: true },
    { id: 'address', label: 'Address', description: 'Full address with street, unit, city, state', enabled: true },
];

// Error messages in multiple languages
const errorMessages = {
    en: {
        systemUnavailable: 'Sorry, our scheduling system is temporarily unavailable. Please contact us by phone.',
        availabilityCheckFailed: 'We could not verify availability. Please try again.',
        appointmentConfirmFailed: 'We could not confirm this time slot. Can I show you other available times?',
        contactCreationFailed: 'There was a problem processing your information. Can you try again in a few minutes?',
        minimumAdjustment: 'Note: Your order has been adjusted to meet our minimum booking value of ${{minimum}}.',
        bookingLimitReached: 'You have reached the maximum number of bookings for this conversation. Please start a new chat for additional bookings.',
    },
    pt: {
        systemUnavailable: 'Desculpe, nosso sistema de agendamento não está disponível no momento. Por favor, entre em contato por telefone.',
        availabilityCheckFailed: 'Não conseguimos verificar a disponibilidade. Por favor, tente novamente.',
        appointmentConfirmFailed: 'Não conseguimos confirmar este horário. Posso mostrar outros horários disponíveis?',
        contactCreationFailed: 'Houve um problema ao processar seus dados. Você pode tentar novamente em alguns minutos?',
        minimumAdjustment: 'Nota: Seu pedido foi ajustado para atender nosso valor mínimo de agendamento de ${{minimum}}.',
        bookingLimitReached: 'Você atingiu o número máximo de agendamentos para esta conversa. Por favor, inicie um novo chat para agendamentos adicionais.',
    },
    es: {
        systemUnavailable: 'Lo sentimos, nuestro sistema de programación no está disponible en este momento. Por favor, contáctenos por teléfono.',
        availabilityCheckFailed: 'No pudimos verificar la disponibilidad. Por favor, inténtelo de nuevo.',
        appointmentConfirmFailed: 'No pudimos confirmar este horario. ¿Puedo mostrarle otros horarios disponibles?',
        contactCreationFailed: 'Hubo un problema al procesar su información. ¿Puede intentarlo de nuevo en unos minutos?',
        minimumAdjustment: 'Nota: Su pedido ha sido ajustado para cumplir con nuestro valor mínimo de reserva de ${{minimum}}.',
        bookingLimitReached: 'Ha alcanzado el número máximo de reservas para esta conversación. Por favor, inicie un nuevo chat para reservas adicionales.',
    }
};

export function getErrorMessage(key: keyof typeof errorMessages['en'], language: string = 'en', replacements: Record<string, string> = {}): string {
    const lang = (language?.toLowerCase().startsWith('pt') ? 'pt' : language?.toLowerCase().startsWith('es') ? 'es' : 'en') as keyof typeof errorMessages;
    let message = errorMessages[lang]?.[key] || errorMessages['en'][key];
    for (const [placeholder, value] of Object.entries(replacements)) {
        message = message.replace(`{{${placeholder}}}`, value);
    }
    return message;
}

// Helper function to calculate price for a cart item based on pricing type
export async function calculateCartItemPrice(
    service: Service,
    cartItem: CartItemData,
    options: ServiceOption[],
    frequencies: ServiceFrequency[]
): Promise<{
    price: number;
    breakdown: PriceBreakdown;
    selectedOptions?: BookingItemOption[];
    selectedFrequency?: BookingItemFrequency;
    areaSize?: string;
    areaValue?: number;
}> {
    const pricingType = service.pricingType || 'fixed_item';
    const quantity = cartItem.quantity || 1;

    switch (pricingType) {
        case 'fixed_item': {
            const unitPrice = Number(service.price);
            const finalPrice = unitPrice * quantity;
            return {
                price: finalPrice,
                breakdown: {
                    subtotal: finalPrice,
                    finalPrice: finalPrice,
                }
            };
        }

        case 'area_based': {
            const areaSizes = (service.areaSizes as AreaSizePreset[]) || [];
            let areaPrice = 0;
            let areaSize = cartItem.areaSize || 'Custom';
            let areaValue = cartItem.areaValue;

            if (cartItem.areaSize && cartItem.areaSize !== 'custom') {
                // Use preset price
                const preset = areaSizes.find(s => s.name === cartItem.areaSize);
                if (preset) {
                    areaPrice = preset.price;
                    areaValue = preset.sqft || undefined;
                }
            } else if (cartItem.areaValue) {
                // Custom area - calculate based on pricePerUnit
                const pricePerUnit = Number(service.pricePerUnit || 0);
                areaPrice = cartItem.areaValue * pricePerUnit;
                areaSize = `Custom: ${cartItem.areaValue} sqft`;
            }

            // Apply minimum price
            const minimumPrice = Number(service.minimumPrice || 0);
            const finalPrice = Math.max(areaPrice, minimumPrice) * quantity;

            return {
                price: finalPrice,
                areaSize,
                areaValue,
                breakdown: {
                    areaPrice,
                    subtotal: areaPrice * quantity,
                    finalPrice,
                }
            };
        }

        case 'base_plus_addons': {
            const basePrice = Number(service.basePrice || service.price);
            let optionsTotal = 0;
            const selectedOptions: BookingItemOption[] = [];

            // Calculate options total
            if (cartItem.selectedOptions && cartItem.selectedOptions.length > 0) {
                for (const selectedOpt of cartItem.selectedOptions) {
                    const option = options.find(o => o.id === selectedOpt.optionId);
                    if (option) {
                        const optPrice = Number(option.price) * selectedOpt.quantity;
                        optionsTotal += optPrice;
                        selectedOptions.push({
                            id: option.id,
                            name: option.name,
                            price: Number(option.price),
                            quantity: selectedOpt.quantity,
                        });
                    }
                }
            }

            let subtotal = (basePrice + optionsTotal) * quantity;
            let discountPercent = 0;
            let discountAmount = 0;
            let selectedFrequency: BookingItemFrequency | undefined;

            // Apply frequency discount
            if (cartItem.selectedFrequencyId) {
                const frequency = frequencies.find(f => f.id === cartItem.selectedFrequencyId);
                if (frequency) {
                    discountPercent = Number(frequency.discountPercent || 0);
                    discountAmount = subtotal * (discountPercent / 100);
                    selectedFrequency = {
                        id: frequency.id,
                        name: frequency.name,
                        discountPercent,
                    };
                }
            }

            const finalPrice = subtotal - discountAmount;

            return {
                price: finalPrice,
                selectedOptions: selectedOptions.length > 0 ? selectedOptions : undefined,
                selectedFrequency,
                breakdown: {
                    basePrice,
                    optionsTotal,
                    subtotal,
                    discountPercent: discountPercent > 0 ? discountPercent : undefined,
                    discountAmount: discountAmount > 0 ? discountAmount : undefined,
                    finalPrice,
                }
            };
        }

        case 'custom_quote': {
            // Custom quote uses minimum price as the base
            const minimumPrice = Number(service.minimumPrice || service.price);
            return {
                price: minimumPrice * quantity,
                breakdown: {
                    subtotal: minimumPrice * quantity,
                    finalPrice: minimumPrice * quantity,
                }
            };
        }

        default:
            // Fallback to fixed price
            const fallbackPrice = Number(service.price) * quantity;
            return {
                price: fallbackPrice,
                breakdown: {
                    subtotal: fallbackPrice,
                    finalPrice: fallbackPrice,
                }
            };
    }
}

export function isValidIsoDate(dateStr?: string | null): dateStr is string {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const parsed = new Date(`${dateStr}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
}

export function parseRelativeDateFromText(text: string, baseDateStr: string): string | null {
    if (!text) return null;
    const normalized = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const baseDate = new Date(`${baseDateStr}T12:00:00`);
    if (Number.isNaN(baseDate.getTime())) return null;

    if (/\b(today|hoje)\b/.test(normalized)) {
        return baseDateStr;
    }

    if (/\b(tomorrow|amanha)\b/.test(normalized)) {
        const tomorrow = new Date(baseDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    const weekdayPatterns: Array<{ day: number; regex: RegExp }> = [
        { day: 0, regex: /\b(sun(day)?|domingo|dom)\b/ },
        { day: 1, regex: /\b(mon(day)?|segunda(-feira)?|seg)\b/ },
        { day: 2, regex: /\b(tue(s(day)?)?|terca(-feira)?|ter)\b/ },
        { day: 3, regex: /\b(wed(nesday)?|quarta(-feira)?|qua)\b/ },
        { day: 4, regex: /\b(thu(rs(day)?)?|quinta(-feira)?|qui)\b/ },
        { day: 5, regex: /\b(fri(day)?|sexta(-feira)?|sex)\b/ },
        { day: 6, regex: /\b(sat(urday)?|sabado|sab)\b/ },
    ];

    const target = weekdayPatterns.find(item => item.regex.test(normalized));
    if (!target) return null;

    const hasNext = /\b(next|proxima|proximo|seguinte|que vem|semana que vem)\b/.test(normalized);
    const hasThis = /\b(this|esta|esse|essa|nesta|neste|desta)\b/.test(normalized);

    const baseDow = baseDate.getDay();
    let delta = (target.day - baseDow + 7) % 7;

    if (delta === 0) {
        if (hasNext) {
            delta = 7;
        } else if (!hasThis) {
            delta = 0;
        }
    }

    const resolved = new Date(baseDate);
    resolved.setDate(resolved.getDate() + delta);
    return resolved.toISOString().split('T')[0];
}

export function parseTimeFromText(text: string): string | null {
    if (!text) return null;
    const normalized = text.toLowerCase();

    const ampmMatch = normalized.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/);
    if (ampmMatch) {
        let hour = Number(ampmMatch[1]);
        const minutes = ampmMatch[2] ? Number(ampmMatch[2]) : 0;
        const isPm = ampmMatch[3].startsWith('p');
        if (hour === 12) {
            hour = isPm ? 12 : 0;
        } else if (isPm) {
            hour += 12;
        }
        const hh = String(hour).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    const match24 = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (match24) {
        const hour = Number(match24[1]);
        const minutes = Number(match24[2]);
        const hh = String(hour).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    return null;
}

export function formatTimeLabel(time24: string): string {
    const [hourStr, minuteStr] = time24.split(':');
    const hourNum = Number(hourStr);
    const minuteNum = Number(minuteStr);
    const period = hourNum >= 12 ? 'pm' : 'am';
    let hour12 = hourNum % 12;
    if (hour12 === 0) hour12 = 12;
    if (!Number.isFinite(minuteNum) || minuteNum === 0) {
        return `${hour12}${period}`;
    }
    const minute = String(minuteNum).padStart(2, '0');
    return `${hour12}:${minute}${period}`;
}

export function formatDateLabel(dateStr: string, longFormat = false): string {
    const dateObj = new Date(`${dateStr}T12:00:00`);
    const dayNamesLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = longFormat ? dayNamesLong[dateObj.getDay()] : dayNamesShort[dateObj.getDay()];
    const monthName = monthNames[dateObj.getMonth()];
    const day = dateObj.getDate();
    return `${dayName} ${monthName} ${day}`;
}

export function formatAvailabilityResponse(suggestions: Array<{ date: string; availableSlots?: string[] }>): string {
    if (!suggestions || suggestions.length === 0) {
        return 'I couldn’t find any available times. Do you want to try a different day?';
    }

    if (suggestions.length === 1) {
        const single = suggestions[0];
        const slots = (single.availableSlots || []).map(formatTimeLabel);
        const label = formatDateLabel(single.date, true);
        if (slots.length === 0) {
            return `${label} doesn’t have any available slots. Do you want a different day?`;
        }
        const bullets = slots.map(slot => `- ${slot}`).join('\n');
        return `${label} has slots at\n${bullets}\nWhich works for you?`;
    }

    const lines = suggestions.map(item => {
        const slots = (item.availableSlots || []).map(formatTimeLabel);
        const label = formatDateLabel(item.date, false);
        return `• ${label} — ${slots.join(', ')}`;
    });
    return `Here are a few options:\n${lines.join('\n')}\nWhich works best for you?`;
}

export function parseZipFromText(text: string): string | null {
    if (!text) return null;
    const match = text.match(/\b\d{5}(?:-\d{4})?\b/);
    return match ? match[0] : null;
}

export function parsePhoneFromText(text: string): string | null {
    if (!text) return null;
    // Extract phone number pattern from text (don't return the whole text)
    const phoneMatch = text.match(/(?:\+?1[-.\s]?)?(?:\(?(\d{3})\)?[-.\s]?)(\d{3})[-.\s]?(\d{4})/);
    if (!phoneMatch) return null;
    // Return just the matched phone number, not the entire text
    return phoneMatch[0].trim();
}

export function parseNameFromText(text: string): string | null {
    if (!text) return null;
    const normalized = text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const patterns = [
        /\b(?:my name is|i am|i'm)\s+([a-z][a-z' -]{1,50})/i,
        /\b(?:meu nome e|meu nome eh|sou)\s+([a-z][a-z' -]{1,50})/i,
        /\b(?:mi nombre es|soy)\s+([a-z][a-z' -]{1,50})/i,
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match) continue;
        const candidate = match[1]
            .split(/[,.;!?]/)[0]
            .trim()
            .split(/\s+/)
            .slice(0, 3)
            .join(' ');
        if (looksLikeName(candidate)) {
            return candidate;
        }
    }

    return null;
}

export function looksLikeName(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 2 || trimmed.length > 60) return false;
    if (!/^[a-zA-Z][a-zA-Z' -]*$/.test(trimmed)) return false;
    // Must contain letters
    if (!/[a-zA-Z]/.test(trimmed)) return false;
    // Reject pure numbers
    if (/^\d+$/.test(trimmed)) return false;
    // Reject if it looks like a sentence (3+ words is already high risk for false positives).
    const words = trimmed.split(/\s+/);
    if (words.length > 3) return false;
    // Each word should start with a letter (names don't start with numbers)
    if (!/^[a-zA-Z]/.test(trimmed)) return false;
    if (!words.every((w) => /^[a-zA-Z][a-zA-Z'-]{1,29}$/.test(w))) return false;

    const blockedTokens = new Set([
        'hi', 'hey', 'hello', 'yes', 'no', 'yep', 'yeah', 'yup', 'nope', 'ok', 'okay', 'sure',
        'thanks', 'thank', 'please', 'help', 'my', 'me', 'we', 'it', 'and', 'but', 'or', 'all',
        'thats', "that's", 'sofa', 'couch', 'rug', 'carpet', 'clean', 'cleaning', 'mattress',
        'ottoman', 'chair', 'armchair', 'loveseat', 'sectional', 'curtain', 'drape', 'upholstery',
        'booking', 'book', 'schedule', 'appointment', 'price', 'cost', 'what', 'when', 'where',
        'why', 'how', 'tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
        'saturday', 'sunday', 'need', 'want', 'have',
    ]);
    if (words.some((w) => blockedTokens.has(w.toLowerCase()))) return false;

    return true;
}

export function looksLikeAddress(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 8 || trimmed.length > 140) return false;
    if (trimmed.includes('?')) return false;
    if (!/\d/.test(trimmed)) return false;
    if (!/[a-z]/i.test(trimmed)) return false;

    const normalized = trimmed.toLowerCase();
    // Reject common service/request phrases that may include numbers.
    if (/\b(clean|cleaning|seater|sofa|carpet|mattress|service|book|booking|schedule|need|want)\b/.test(normalized)) {
        return false;
    }

    // Require at least one common address token to avoid false positives.
    const addressToken =
        /\b(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|ln|lane|ct|court|way|pl|place|apt|suite|unit)\b/i;
    const hasCommaSeparatedParts = trimmed.split(',').length >= 2;
    return addressToken.test(trimmed) || hasCommaSeparatedParts;
}

export function parseAddressFromText(text: string): string | null {
    if (!text) return null;
    const compact = text.replace(/\s+/g, ' ').trim();

    const explicitMarker = compact.match(/\b(?:address is|my address is|address:)\s*(.+)$/i);
    const candidateFromMarker = explicitMarker?.[1]?.trim();
    if (candidateFromMarker && looksLikeAddress(candidateFromMarker)) {
        return candidateFromMarker.replace(/[.,;!?]+$/, '').trim();
    }

    // Fallback: try to extract from first street-number token through end.
    const streetStart = compact.search(/\b\d{1,6}\s+[A-Za-z0-9.'-]+\b/);
    if (streetStart === -1) return null;
    const tail = compact.slice(streetStart).trim();
    if (!looksLikeAddress(tail)) return null;
    return tail.replace(/[.,;!?]+$/, '').trim();
}

export function isAffirmativeResponse(text: string): boolean {
    if (!text) return false;
    const normalized = text
        .toLowerCase()
        .trim();

    // Avoid treating explicit negatives as confirmation.
    if (/\b(no|nope|not now|don't|do not|cancel)\b/.test(normalized)) {
        return false;
    }

    if (/^(yes|yep|yeah|yup|correct|right|sure|ok|okay|confirm|sounds good|sounds right|that's right|that is right|please do|go ahead)$/.test(normalized)) {
        return true;
    }

    // Long confirmations are common in natural chat ("Yes, please confirm and create the booking now.").
    if (/^(yes|yep|yeah|yup|sure|ok|okay)\b/.test(normalized)) {
        return true;
    }

    return /\b(confirm|please do|go ahead|book it|lock it in|sounds good|sounds right|that works)\b/.test(normalized);
}

export function detectMessageLanguage(text: string): 'en' | 'pt-BR' | 'es' | null {
    if (!text) return null;
    const normalized = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const ptHints = /\b(ola|oi|voce|voces|preciso|quero|agendar|limpeza|endereco|telefone|cep|amanha|hoje|tarde|obrigado)\b/;
    const esHints = /\b(hola|usted|necesito|quiero|reservar|limpieza|direccion|telefono|manana|hoy|tarde|gracias)\b/;

    if (ptHints.test(normalized)) return 'pt-BR';
    if (esHints.test(normalized)) return 'es';
    return 'en';
}

export function isLikelyDirectQuestion(text: string): boolean {
    if (!text) return false;
    const normalized = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    if (normalized.includes('?')) return true;
    return /\b(what|which|when|where|who|how|do you|can you|is there|are there|quanto|quais|qual|quando|onde|como|voces|tem|tiene|tienen|cuando|donde|como)\b/.test(normalized);
}

export function isServiceConfirmationPrompt(text: string): boolean {
    if (!text) return false;
    const normalized = text.toLowerCase();
    // Match various confirmation prompts the AI might use
    return /(sound(s)? (right|good)|is that (right|correct|okay)|does that (sound|look|work)|that work|work for you|correct\?|right\?)/.test(normalized);
}

export function isBookingConfirmationPrompt(text: string): boolean {
    if (!text) return false;
    const normalized = text.toLowerCase();
    // Match booking confirmation prompts like "Confirm booking?", "Ready to book?", "Sound good?", etc.
    const hasBookingContext = /(booking|appointment|schedule|confirm|ready to book|shall i book|want me to book)/.test(normalized);
    const hasConfirmQuestion = /(sound(s)? good|confirm\??|ready\??|shall i|want me to|go ahead|proceed|book it|set\?)/.test(normalized);
    // Also match summaries with date + time + price pattern (no hardcoded service names)
    const hasSummaryPattern = /\b(at|on)\b.*\b(am|pm|\d{1,2}:\d{2})\b/.test(normalized) &&
        /\$\d+/.test(normalized);
    return (hasBookingContext && hasConfirmQuestion) || (hasSummaryPattern && hasConfirmQuestion);
}

export function detectDateWindowFromText(text: string): { startOffsetDays: number; windowDays: number; maxSuggestions: number } | null {
    if (!text) return null;
    const normalized = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (/\b(next week|proxima semana|semana que vem|na semana que vem)\b/.test(normalized)) {
        return { startOffsetDays: 7, windowDays: 7, maxSuggestions: 5 };
    }

    if (/\b(this week|esta semana|nessa semana|nesta semana)\b/.test(normalized)) {
        return { startOffsetDays: 0, windowDays: 7, maxSuggestions: 5 };
    }

    if (/\b(in two weeks|in 2 weeks|two weeks from now|daqui duas semanas|daqui 2 semanas|em duas semanas|em 2 semanas)\b/.test(normalized)) {
        return { startOffsetDays: 14, windowDays: 7, maxSuggestions: 5 };
    }

    return null;
}

export function pickRandomSlots(slots: string[], maxSlots: number): string[] {
    if (!slots || slots.length === 0) return [];
    return [...slots]
        .sort((a, b) => a.localeCompare(b))
        .slice(0, Math.max(1, maxSlots));
}

export function formatBusinessHoursSummary(businessHours?: BusinessHours | null): string {
    if (!businessHours) return '';
    const dayLabels: Array<{ key: keyof BusinessHours; label: string }> = [
        { key: 'monday', label: 'Mon' },
        { key: 'tuesday', label: 'Tue' },
        { key: 'wednesday', label: 'Wed' },
        { key: 'thursday', label: 'Thu' },
        { key: 'friday', label: 'Fri' },
        { key: 'saturday', label: 'Sat' },
        { key: 'sunday', label: 'Sun' },
    ];

    const parts = dayLabels.map(({ key, label }) => {
        const hours = businessHours[key];
        if (!hours?.isOpen) return `${label} closed`;
        return `${label} ${hours.start}-${hours.end}`;
    });

    return parts.join(', ');
}

export function normalizeServiceName(value: string): string {
    return value
        .toLowerCase()
        .replace(/cleaning/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function sanitizeAssistantResponse(text: string): string {
    const forbidden = [
        /one moment/i,
        /hold on/i,
        /please wait/i,
        /let me check/i,
        /i'?ll check/i,
        /checking (that|availability|the schedule)/i,
        /just a moment/i,
    ];
    const parts = text.match(/[^.!?]+[.!?]*/g) || [text];
    const filtered = parts.filter((part) => !forbidden.some((re) => re.test(part)));
    const cleaned = filtered.join(' ').replace(/\s+/g, ' ').trim();
    return cleaned || 'Got it.';
}

export function getIntakeQuestion(objectiveId: IntakeObjective['id'], language: string = 'en'): string {
    const lang = language?.toLowerCase().startsWith('pt')
        ? 'pt'
        : language?.toLowerCase().startsWith('es')
            ? 'es'
            : 'en';

    const copy = {
        en: {
            zipcode: "What's your ZIP code?",
            serviceType: 'What service do you need?',
            serviceDetails: 'Any size, material, or special details I should know?',
            date: 'What day and time would you like to schedule?',
            name: "What's your full name?",
            phone: "What's the best phone number to reach you?",
            address: "What's the full address?",
            fallback: 'What should we start with?',
        },
        pt: {
            zipcode: 'Qual é o seu ZIP code?',
            serviceType: 'Qual serviço você precisa?',
            serviceDetails: 'Tem algum detalhe de tamanho, material ou observação?',
            date: 'Qual dia você gostaria de agendar?',
            name: 'Qual é o seu nome completo?',
            phone: 'Qual é o melhor telefone para contato?',
            address: 'Qual é o endereço completo?',
            fallback: 'Por onde você quer começar?',
        },
        es: {
            zipcode: '¿Cuál es su código ZIP?',
            serviceType: '¿Qué servicio necesita?',
            serviceDetails: '¿Hay detalles de tamaño, material o notas especiales?',
            date: '¿Qué día le gustaría agendar?',
            name: '¿Cuál es su nombre completo?',
            phone: '¿Cuál es el mejor teléfono para contactarle?',
            address: '¿Cuál es la dirección completa?',
            fallback: '¿Por dónde empezamos?',
        },
    } as const;

    const selected = copy[lang];
    switch (objectiveId) {
        case 'zipcode':
            return selected.zipcode;
        case 'serviceType':
            return selected.serviceType;
        case 'serviceDetails':
            return selected.serviceDetails;
        case 'date':
            return selected.date;
        case 'name':
            return selected.name;
        case 'phone':
            return selected.phone;
        case 'address':
            return selected.address;
        default:
            return selected.fallback;
    }
}

export function responseMentionsObjective(response: string, objectiveId: IntakeObjective['id']): boolean {
    const text = response.toLowerCase();
    switch (objectiveId) {
        case 'zipcode':
            return /zip|postal/.test(text);
        case 'serviceType':
            return /service|cleaning|sofa|chair|mattress|carpet|rug|upholstery/.test(text);
        case 'serviceDetails':
            return /size|seater|details|material|notes|how many|which/.test(text);
        case 'date':
            // Match date/time related words including time slots like "9am", "10:00", etc.
            return /date|day|schedule|when|slot|available|time|\d+\s*(am|pm)|monday|tuesday|wednesday|thursday|friday|saturday|sunday/.test(text);
        case 'name':
            return /name/.test(text);
        case 'phone':
            return /phone|number/.test(text);
        case 'address':
            return /address|street|city|state/.test(text);
        default:
            return false;
    }
}

export function isIntakeObjectiveComplete(
    objectiveId: IntakeObjective['id'],
    conversation: any,
    collectedData: Record<string, any>,
    cart: Array<any>
): boolean {
    switch (objectiveId) {
        case 'zipcode':
            // In the US flow, full address is enough to determine where the job will happen.
            // Keep ZIP in intake, but do not block progress when address is already provided.
            return !!(
                collectedData?.zipcode ||
                conversation?.visitorZipcode ||
                collectedData?.address ||
                conversation?.visitorAddress
            );
        case 'serviceType':
            return Array.isArray(cart) && cart.length > 0;
        case 'serviceDetails':
            return !!(collectedData?.serviceDetails || (Array.isArray(cart) && cart.length > 0));
        case 'date':
            return !!((collectedData?.selectedDate || collectedData?.preferredDate) && collectedData?.selectedTime);
        case 'name':
            return !!(collectedData?.name || conversation?.visitorName);
        case 'phone':
            return !!(collectedData?.phone || conversation?.visitorPhone);
        case 'address':
            return !!(collectedData?.address || conversation?.visitorAddress);
        default:
            return false;
    }
}

export function getNextIntakeObjective(
    enabledObjectives: IntakeObjective[],
    conversation: any,
    collectedData: Record<string, any>,
    cart: Array<any>
): IntakeObjective | null {
    for (const objective of enabledObjectives) {
        if (!isIntakeObjectiveComplete(objective.id, conversation, collectedData, cart)) {
            return objective;
        }
    }
    return null;
}

export function getChatPromptTemplate(): string {
    // Load chat prompt template from markdown file (prefer docs)
    const CHAT_PROMPT_PATHS = [
        path.join(currentDir, '..', '..', '..', 'docs', 'chat', 'prompt.md'),
        path.join(currentDir, '..', '..', '..', 'server', 'prompts', 'chat-booking.md'),
    ];

    let chatPromptTemplate = '';
    let chatPromptPathUsed = '';

    for (const promptPath of CHAT_PROMPT_PATHS) {
        try {
            if (fs.existsSync(promptPath)) {
                chatPromptTemplate = fs.readFileSync(promptPath, 'utf-8');
                chatPromptPathUsed = promptPath;
                break;
            }
        } catch {
            // try next path
        }
    }

    if (chatPromptTemplate) {
        // Extract the base prompt content (skip only the markdown header)
        const promptStart = chatPromptTemplate.indexOf('You are a friendly booking assistant');
        const promptEnd = chatPromptTemplate.indexOf('# ANTI-PATTERNS');

        if (promptStart !== -1 && promptEnd !== -1) {
            chatPromptTemplate = chatPromptTemplate.substring(promptStart, promptEnd).trim();
        } else if (promptStart !== -1) {
            chatPromptTemplate = chatPromptTemplate.substring(promptStart).trim();
        }

        // Clean up extra whitespace/newlines
        chatPromptTemplate = chatPromptTemplate.replace(/\n{3,}/g, '\n\n');
        console.log('[Chat] Loaded prompt template from', chatPromptPathUsed, '- length:', chatPromptTemplate.length);
        return chatPromptTemplate;
    } else {
        console.error('[Chat] Failed to load prompt template from files');
        return '';
    }
}
