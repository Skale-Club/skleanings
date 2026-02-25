/**
 * ✅ DEPENDENCY INJECTION: Chat module dependencies
 *
 * This file provides a centralized way to configure chat dependencies.
 * For multi-tenant SaaS or testing, you can override these dependencies.
 *
 * Usage:
 * ```typescript
 * import { chatDependencies } from './dependencies';
 *
 * // In your tool function:
 * const services = await chatDependencies.storage.getServices();
 * ```
 *
 * To override (e.g., for testing or multi-tenant):
 * ```typescript
 * import { setChatDependencies } from './dependencies';
 *
 * setChatDependencies({
 *   storage: customStorageInstance,
 *   ghl: customGHLClient,
 *   twilio: customTwilioClient,
 *   openai: customOpenAIClient
 * });
 * ```
 */

import type { IStorage } from "../../storage"; 
import { storage as defaultStorage } from "../../storage"; 
import * as ghlDefault from "../../integrations/ghl"; 
import * as twilioDefault from "../../integrations/twilio"; 
import * as telegramDefault from "../../integrations/telegram";
import { getOpenAIClient as defaultGetOpenAIClient } from "../../lib/openai"; 
import { getGeminiClient as defaultGetGeminiClient } from "../../lib/gemini";
import { getOpenRouterClient as defaultGetOpenRouterClient } from "../../lib/openrouter";

export interface ChatDependencies { 
  storage: IStorage; 
  ghl: typeof ghlDefault; 
  twilio: typeof twilioDefault; 
  telegram: typeof telegramDefault;
  getOpenAIClient: typeof defaultGetOpenAIClient; 
  getGeminiClient: typeof defaultGetGeminiClient;
  getOpenRouterClient: typeof defaultGetOpenRouterClient;
} 
 
let _dependencies: ChatDependencies = { 
  storage: defaultStorage, 
  ghl: ghlDefault, 
  twilio: twilioDefault, 
  telegram: telegramDefault,
  getOpenAIClient: defaultGetOpenAIClient, 
  getGeminiClient: defaultGetGeminiClient,
  getOpenRouterClient: defaultGetOpenRouterClient,
}; 

/**
 * Get current chat dependencies
 */
export function getChatDependencies(): ChatDependencies {
  return _dependencies;
}

/**
 * Override chat dependencies (useful for testing or multi-tenant isolation)
 * @param deps - Partial or full dependency overrides
 */
export function setChatDependencies(deps: Partial<ChatDependencies>) {
  _dependencies = {
    ..._dependencies,
    ...deps,
  };
}

/**
 * Reset dependencies to defaults (useful for tests)
 */
export function resetChatDependencies() { 
  _dependencies = { 
    storage: defaultStorage, 
    ghl: ghlDefault, 
    twilio: twilioDefault, 
    telegram: telegramDefault,
    getOpenAIClient: defaultGetOpenAIClient, 
    getGeminiClient: defaultGetGeminiClient,
    getOpenRouterClient: defaultGetOpenRouterClient,
  }; 
} 

/**
 * Convenience exports for backward compatibility
 * Chat tools can use these directly: `chatDeps.storage.getServices()`
 */
export const chatDeps = { 
  get storage() { 
    return _dependencies.storage; 
  }, 
  get ghl() { 
    return _dependencies.ghl; 
  }, 
  get twilio() { 
    return _dependencies.twilio; 
  }, 
  get telegram() {
    return _dependencies.telegram;
  },
  get getOpenAIClient() { 
    return _dependencies.getOpenAIClient; 
  }, 
  get getGeminiClient() {
    return _dependencies.getGeminiClient;
  },
  get getOpenRouterClient() {
    return _dependencies.getOpenRouterClient;
  },
}; 
