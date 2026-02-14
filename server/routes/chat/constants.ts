/**
 * Chat System Constants
 * Centralized constants and enums to avoid magic strings throughout the codebase
 */

// Conversation status values
export const CONVERSATION_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

export type ConversationStatus = typeof CONVERSATION_STATUS[keyof typeof CONVERSATION_STATUS];

// Message role values
export const MESSAGE_ROLE = {
  VISITOR: 'visitor',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',
} as const;

export type MessageRole = typeof MESSAGE_ROLE[keyof typeof MESSAGE_ROLE];

// URL rule match types
export const URL_MATCH_TYPE = {
  EQUALS: 'equals',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts_with',
} as const;

export type UrlMatchType = typeof URL_MATCH_TYPE[keyof typeof URL_MATCH_TYPE];

// Chat tool names
export const CHAT_TOOL = {
  LIST_SERVICES: 'list_services',
  GET_SERVICE_DETAILS: 'get_service_details',
  ADD_SERVICE: 'add_service',
  REMOVE_SERVICE: 'remove_service',
  VIEW_CART: 'get_cart', // Note: API uses 'get_cart', keeping for compatibility
  CLEAR_CART: 'clear_cart',
  SUGGEST_BOOKING_DATES: 'suggest_booking_dates',
  CREATE_BOOKING: 'create_booking',
  SEARCH_FAQS: 'search_faqs',
  UPDATE_MEMORY: 'update_memory',
  UPDATE_CONTACT: 'update_contact',
  GET_BUSINESS_POLICIES: 'get_business_policies',
} as const;

export type ChatTool = typeof CHAT_TOOL[keyof typeof CHAT_TOOL];

// Intake objective IDs
export const INTAKE_OBJECTIVE = {
  NAME: 'name',
  PHONE: 'phone',
  EMAIL: 'email',
  ADDRESS: 'address',
  ZIPCODE: 'zipcode',
  SERVICE_DETAILS: 'service_details',
  PREFERRED_DATE: 'preferred_date',
} as const;

export type IntakeObjectiveId = typeof INTAKE_OBJECTIVE[keyof typeof INTAKE_OBJECTIVE];

// Message delivery status
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
} as const;

export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];

// Rate limiting
export const RATE_LIMIT = {
  MAX_MESSAGES_PER_MINUTE: 10,
  MAX_MESSAGES_PER_HOUR: 60,
  WINDOW_MS: 60000, // 1 minute
} as const;

// OpenAI Configuration
export const OPENAI_CONFIG = {
  DEFAULT_MODEL: 'gpt-4o-mini',
  MAX_COMPLETION_TOKENS: 800,
  TEMPERATURE: 0.7,
  DEFAULT_TIMEOUT_MS: 30000,
} as const;

// Cache TTL (Time To Live)
export const CACHE_TTL = {
  SERVICES: 5 * 60 * 1000, // 5 minutes
  FAQS: 5 * 60 * 1000, // 5 minutes
  AVAILABILITY: 2 * 60 * 1000, // 2 minutes
} as const;

// Auto-capture thresholds
export const AUTO_CAPTURE = {
  MIN_HISTORY_FOR_NAME: 3, // Minimum non-internal messages before name capture
  MAX_CONSECUTIVE_SAME_STEP: 3, // Max times to ask same intake question
} as const;

// Conversation auto-close
export const CONVERSATION_AUTO_CLOSE = {
  INACTIVE_HOURS: 24, // Hours of inactivity before auto-close
  CHECK_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
} as const;
