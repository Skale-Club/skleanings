/**
 * search_faqs tool
 * 
 * Search frequently asked questions database to answer questions
 * about policies, cleaning process, products, guarantees, etc.
 */

import { CHAT_TOOL } from '../constants';
import { getCachedFaqs } from './cache';
import type { ToolHandler } from './registry';
import { type SearchFaqsInput } from './schemas';

// Synonym map for FAQ search
const FAQ_SYNONYMS: Record<string, string[]> = {
    pet: ['pet', 'pets', 'animal', 'dog', 'cat'],
    children: ['children', 'child', 'kids', 'kid', 'baby'],
    safe: ['safe', 'safety', 'seguro', 'segura'],
    products: ['product', 'products', 'chemicals', 'cleaners', 'detergent'],
    cancellation: ['cancel', 'cancellation', 'reschedule', 'refund'],
    guarantee: ['guarantee', 'warranty', 'satisfaction'],
    payment: ['payment', 'pay', 'card', 'cash', 'invoice'],
};

/**
 * Normalize text for search
 */
function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Handler for search_faqs tool
 */
export const searchFaqsHandler: ToolHandler<SearchFaqsInput> = async (args) => {
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

    // Tokenize and expand with synonyms
    const tokenized = normalizeText(query).split(/[^a-z0-9]+/).filter(Boolean);
    const expandedTokens = new Set<string>();

    for (const token of tokenized) {
        expandedTokens.add(token);
        for (const [key, values] of Object.entries(FAQ_SYNONYMS)) {
            if (token === key || values.includes(token)) {
                values.forEach((val) => expandedTokens.add(val));
                expandedTokens.add(key);
            }
        }
    }

    // Score FAQs by match
    const scored = allFaqs.map((faq) => {
        const haystack = `${normalizeText(faq.question || '')} ${normalizeText(faq.answer || '')}`;
        let score = 0;

        if (haystack.includes(normalizeText(query))) score += 50;
        for (const token of Array.from(expandedTokens)) {
            if (token.length < 2) continue;
            if (haystack.includes(token)) score += 6;
        }

        return { faq, score };
    });

    // Filter, sort, and limit results
    const filtered = scored
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => item.faq);

    // Fallback to top 3 FAQs if no matches
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
};

// Tool definition
export const searchFaqsTool = {
    name: CHAT_TOOL.SEARCH_FAQS,
    description: 'Search frequently asked questions database to answer questions about policies, cleaning process, products, guarantees, cancellation, and other common inquiries',
    inputSchema: {
        type: 'object' as const,
        properties: {
            query: {
                type: 'string',
                description: 'Optional search keywords to filter FAQs (e.g., "cancellation", "products", "guarantee"). Leave empty to get all FAQs.',
            },
        },
        additionalProperties: false,
    },
    handler: searchFaqsHandler,
};
