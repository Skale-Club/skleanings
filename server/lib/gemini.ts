import { OpenAI } from "openai";

// Latest stable Gemini models (as of 2025-12 / 2026-02) are 2.5, while 3.* are previews.
// We expose the model choice in Admin -> Integrations.
export const DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.5-flash";

// Google Gemini API (AI Studio) also supports an OpenAI-compatible endpoint.
// This lets us reuse the existing OpenAI Chat Completions + tools flow.
const GEMINI_OPENAI_COMPAT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

let runtimeGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

export function getRuntimeGeminiKey() {
  return runtimeGeminiKey;
}

export function setRuntimeGeminiKey(key: string) {
  runtimeGeminiKey = key;
}

export function getGeminiClient(apiKey?: string) {
  const key = apiKey || runtimeGeminiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: GEMINI_OPENAI_COMPAT_BASE_URL,
  });
}
