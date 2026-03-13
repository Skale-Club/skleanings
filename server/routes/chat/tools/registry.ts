/**
 * Chat Tool Registry
 * 
 * This module provides a unified registry for all chat tools.
 * Each tool is defined with its schema, handler, and metadata.
 * 
 * Inspired by Vercel AI SDK patterns but adapted for OpenAI function calling.
 */

import { ChatError, toChatToolErrorResult } from '../../../lib/chat-errors';
import { CHAT_TOOL } from '../constants';
import type { IntakeObjective } from '../utils';

// Import schemas
import {
    type ListServicesInput,
    type GetServiceDetailsInput,
    type SuggestBookingDatesInput,
    type CreateBookingInput,
    type UpdateContactInput,
    type UpdateMemoryInput,
    type AddServiceInput,
    type ViewCartInput,
    type GetBusinessPoliciesInput,
    type SearchFaqsInput,
} from './schemas';

// OpenAI function parameters type
export type FunctionParameters = {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
};

// Tool handler types
export type ToolHandler<T = Record<string, unknown>> = (
    args: T,
    conversationId?: string,
    options?: {
        language?: string;
        userMessage?: string;
        userMessageId?: string;
    }
) => Promise<any>;

// Tool definition
export interface ToolDefinition<T = Record<string, unknown>> {
    name: string;
    description: string;
    inputSchema: FunctionParameters;
    handler: ToolHandler<T>;
    requiresConversationId?: boolean;
}

// Tool registry map
const toolRegistry = new Map<string, ToolDefinition<any>>();

/**
 * Register a tool in the registry
 */
export function registerTool<T>(definition: ToolDefinition<T>): void {
    toolRegistry.set(definition.name, definition);
}

/**
 * Get a tool from the registry
 */
export function getTool(name: string): ToolDefinition<any> | undefined {
    return toolRegistry.get(name);
}

/**
 * Get all registered tools
 */
export function getAllTools(): ToolDefinition<any>[] {
    return Array.from(toolRegistry.values());
}

/**
 * Build OpenAI-compatible tool definitions for the chat completion API
 */
export function buildChatTools(_enabledObjectives: IntakeObjective[]): Array<{
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: FunctionParameters;
    };
}> {
    const allTools = getAllTools();

    return allTools.map(tool => ({
        type: 'function' as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
        },
    }));
}

/**
 * Run a tool by name
 */
export async function runTool(
    name: string,
    args: Record<string, unknown>,
    conversationId?: string,
    options?: {
        language?: string;
        userMessage?: string;
        userMessageId?: string;
    }
): Promise<any> {
    const tool = getTool(name);
    if (!tool) {
        return toChatToolErrorResult(
            new ChatError('tool:not_found', `Unknown tool: ${name}`)
        );
    }

    try {
        return await tool.handler(args, conversationId, options);
    } catch (error: any) {
        console.error(`[Tool:${name}] Error:`, error);
        return toChatToolErrorResult(error);
    }
}
