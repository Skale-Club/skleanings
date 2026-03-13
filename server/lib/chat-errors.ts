/**
 * Structured chat errors used by the chat route and tool runtime.
 *
 * The current chat flow still consumes object results from tools, so this
 * module also provides a normalized conversion layer for tool failures.
 */

export type ChatErrorCode =
    | 'bad_request:api'
    | 'bad_request:tool'
    | 'unauthorized:chat'
    | 'unauthorized:admin'
    | 'forbidden:chat'
    | 'rate_limit:chat'
    | 'provider:unavailable'
    | 'tool:not_found'
    | 'conversation:required'
    | 'conversation:not_found'
    | 'service:not_found'
    | 'booking:missing_fields'
    | 'booking:slot_taken'
    | 'booking:slot_unavailable'
    | 'booking:creation_failed'
    | 'internal:error';

type ErrorInfo = {
    message: string;
    statusCode: number;
};

const ERROR_MAP: Record<ChatErrorCode, ErrorInfo> = {
    'bad_request:api': { message: 'Invalid request parameters.', statusCode: 400 },
    'bad_request:tool': { message: 'Invalid tool parameters.', statusCode: 400 },
    'unauthorized:chat': { message: 'Authentication required.', statusCode: 401 },
    'unauthorized:admin': { message: 'Admin authentication required.', statusCode: 401 },
    'forbidden:chat': { message: 'Access denied to this chat.', statusCode: 403 },
    'rate_limit:chat': { message: 'Too many requests. Please slow down.', statusCode: 429 },
    'provider:unavailable': { message: 'AI provider is temporarily unavailable.', statusCode: 503 },
    'tool:not_found': { message: 'Requested tool is not registered.', statusCode: 400 },
    'conversation:required': { message: 'Conversation ID is required.', statusCode: 400 },
    'conversation:not_found': { message: 'Conversation not found.', statusCode: 404 },
    'service:not_found': { message: 'Service not found.', statusCode: 404 },
    'booking:missing_fields': { message: 'Missing required booking fields.', statusCode: 400 },
    'booking:slot_taken': { message: 'This time slot is currently locked.', statusCode: 409 },
    'booking:slot_unavailable': { message: 'This time slot is no longer available.', statusCode: 409 },
    'booking:creation_failed': { message: 'Failed to create booking.', statusCode: 500 },
    'internal:error': { message: 'An internal error occurred.', statusCode: 500 },
};

export class ChatError extends Error {
    public readonly code: ChatErrorCode;
    public readonly statusCode: number;

    constructor(code: ChatErrorCode, customMessage?: string) {
        const errorInfo = ERROR_MAP[code];
        super(customMessage || errorInfo.message);
        this.code = code;
        this.statusCode = errorInfo.statusCode;
    }

    toResponse() {
        return {
            error: this.message,
            code: this.code,
            statusCode: this.statusCode,
        };
    }

    toLogContext(): Record<string, unknown> {
        return {
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
        };
    }
}

export type ChatToolErrorResult = {
    success: false;
    error: string;
    errorCode: ChatErrorCode;
};

export function isChatError(error: unknown): error is ChatError {
    return error instanceof ChatError;
}

export function toChatToolErrorResult(error: unknown): ChatToolErrorResult {
    if (isChatError(error)) {
        const { code, message } = error;
        return {
            success: false,
            error: message,
            errorCode: code,
        };
    }

    return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred.',
        errorCode: 'internal:error',
    };
}
