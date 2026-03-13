/**
 * list_services tool
 *
 * Lists all available cleaning services from the catalog.
 * Supports semantic search with smart matching.
 */

import { CHAT_TOOL } from '../constants';
import { getCachedServices } from './cache';
import {
    normalizeSemanticText,
    formatServiceForTool,
    buildClarificationQuestion,
    hasStrongTopServiceMatch,
} from './shared';
import type { ToolHandler, FunctionParameters } from './registry';
import { listServicesSchema, type ListServicesInput } from './schemas';

// Synonyms for service search
const SERVICE_SYNONYMS: Record<string, string[]> = {
    'sectional': ['sectional', 'l-shaped', 'l shaped', 'corner', 'modular'],
    'sofa': ['sofa', 'couch', 'settee', 'loveseat', 'seater', 'upholstery'],
    'carpet': ['carpet', 'rug', 'runner', 'hallway', 'stairs', 'floor'],
    'mattress': ['mattress', 'bed'],
    'chair': ['chair', 'armchair', 'recliner', 'chaise', 'office', 'dining'],
};

/**
 * Handler for list_services tool
 */
export const listServicesHandler: ToolHandler<ListServicesInput> = async (args) => {
    const services = await getCachedServices();
    const rawQuery = (args?.query as string | undefined)?.trim();
    const query = normalizeSemanticText(rawQuery || '');

    // No query - return all services
    if (!query) {
        return { services: services.map(formatServiceForTool) };
    }

    // Extract numbers from query (e.g., "7 seater" -> 7, "7-8 seater" -> [7,8])
    const queryNumbers = query.match(/\d+/g)?.map(Number) || [];
    const queryWords = query.split(/[\s,]+/).filter(w => w.length > 2);

    // Expand query with synonyms
    const expandedQueryWords = new Set(queryWords);
    for (const word of queryWords) {
        for (const [key, syns] of Object.entries(SERVICE_SYNONYMS)) {
            if (syns.includes(word) || key === word) {
                syns.forEach(s => expandedQueryWords.add(s));
            }
        }
    }

    // Score services based on query match
    const scoredServices = services.map(service => {
        const name = normalizeSemanticText(service.name || '');
        const desc = normalizeSemanticText(service.description || '');
        const semantic = getServiceSemanticProfileSimple(service);
        const semanticText = semantic.matchHints.join(' ');
        let score = 0;

        // Exact name match bonus
        if (name.includes(query)) score += 100;

        // Number matching for seaters, sizes, etc.
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

        // Word matching
        for (const word of Array.from(expandedQueryWords)) {
            if (name.includes(word)) score += 10;
            if (desc.includes(word)) score += 5;
            if (semanticText.includes(word)) score += 8;
        }

        return { service, score };
    });

    // Filter and sort by score
    const filtered = scoredServices
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);

    const ranked = filtered.length > 0 ? filtered : services.map((service) => ({ service, score: 0 }));
    const result = ranked.map((item) => item.service);

    // Build clarification question if no strong match
    const clarificationQuestion =
        rawQuery && !hasStrongTopServiceMatch(rawQuery, ranked)
            ? buildClarificationQuestion(rawQuery, result.slice(0, 5))
            : null;

    return {
        services: result.map(formatServiceForTool),
        clarificationQuestion,
    };
};

// Simple semantic profile (imported from shared to avoid circular deps)
function getServiceSemanticProfileSimple(service: any): { family: string; matchHints: string[] } {
    const source = normalizeSemanticText(`${service?.name || ''} ${service?.description || ''}`);
    const hints = new Set<string>();
    let family = 'general';

    if (/\b(sofa|couch|loveseat|sectional|settee|l-shaped|l shaped)\b/.test(source)) {
        family = 'sofa';
        hints.add('sofa');
        hints.add('couch');
        hints.add('upholstery');
    } else if (/\b(mattress|bed frame|headboard|bed)\b/.test(source)) {
        family = 'bed';
        hints.add('mattress');
        hints.add('bed');
    } else if (/\b(carpet|rug|hallway|stairs|basement|attic|room)\b/.test(source)) {
        family = 'carpet';
        hints.add('carpet');
        hints.add('rug');
        hints.add('floor cleaning');
    } else if (/\b(chair|armchair|recliner|chaise lounge|chaise|office chair|dining chair)\b/.test(source)) {
        family = 'chair';
        hints.add('chair');
    } else if (/\b(curtain|drape)\b/.test(source)) {
        family = 'curtain';
        hints.add('curtain');
        hints.add('drape');
    }

    return {
        family,
        matchHints: Array.from(hints),
    };
}

// Tool definition
export const listServicesTool = {
    name: CHAT_TOOL.LIST_SERVICES,
    description: `List all available cleaning services from our catalog. Results include descriptions, semantic match hints, and may include a clarificationQuestion when the customer's request is still ambiguous. If clarificationQuestion is present, ask that instead of listing internal catalog options. CRITICAL: You must ONLY recommend services that exist in this list. Never combine multiple smaller services when a single larger service exists. For example, if customer needs a 7-seater cleaned, recommend the 7-8 Seater service, NOT multiple 3-seater sessions.`,
    inputSchema: {
        type: 'object' as const,
        properties: {
            query: {
                type: 'string',
                description: 'Search by size/type (e.g. "7 seater", "sectional", "large", "loveseat"). The system uses smart matching to find relevant services.'
            },
        },
        additionalProperties: false,
    },
    handler: listServicesHandler,
};
