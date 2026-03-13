/**
 * Shared utilities for chat tools
 * 
 * Contains common helper functions used across multiple tools
 */

import { ChatError } from '../../../lib/chat-errors';
import { chatDeps } from '../dependencies';
import { getCachedServices } from './cache';

/**
 * Normalize text for semantic matching
 * Removes accents and converts to lowercase
 */
export function normalizeSemanticText(value: string): string {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Get semantic profile for a service (family and match hints)
 */
export function getServiceSemanticProfile(service: any): { family: string; matchHints: string[] } {
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

/**
 * Format a service for tool output
 */
export function formatServiceForTool(service: any) {
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

/**
 * Build a clarification question for ambiguous service queries
 */
export function buildClarificationQuestion(query: string, candidateServices: any[]): string | null {
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

/**
 * Check if there's a strong top service match
 */
export function hasStrongTopServiceMatch(
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

/**
 * Normalize a service name for comparison
 */
export function normalizeServiceName(name: string): string {
    return (name || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * Add an internal conversation message
 */
export async function addInternalConversationMessage(
    conversationId: string,
    content: string,
    metadata: Record<string, any> = {}
): Promise<void> {
    const crypto = await import('crypto');
    const { MESSAGE_ROLE } = await import('../constants');

    await chatDeps.storage.addConversationMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: MESSAGE_ROLE.ASSISTANT,
        content,
        metadata: { ...metadata, internal: true },
    });
}

export function requireConversationId(conversationId?: string): string {
    if (!conversationId) {
        throw new ChatError('conversation:required');
    }
    return conversationId;
}

export async function requireConversation(conversationId?: string) {
    const resolvedConversationId = requireConversationId(conversationId);
    const conversation = await chatDeps.storage.getConversation(resolvedConversationId);
    if (!conversation) {
        throw new ChatError('conversation:not_found');
    }
    return conversation;
}

export async function requireService(serviceId: number) {
    const service = await chatDeps.storage.getService(serviceId);
    if (!service) {
        throw new ChatError('service:not_found');
    }
    return service;
}
