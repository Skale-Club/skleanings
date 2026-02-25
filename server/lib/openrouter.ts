import { OpenAI } from "openai";

export const DEFAULT_OPENROUTER_CHAT_MODEL = "openai/gpt-4o-mini";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

let runtimeOpenRouterKey = process.env.OPENROUTER_API_KEY || "";

export function getRuntimeOpenRouterKey() {
  return runtimeOpenRouterKey;
}

export function setRuntimeOpenRouterKey(key: string) {
  runtimeOpenRouterKey = key;
}

export function getOpenRouterClient(apiKey?: string) {
  const key = apiKey || runtimeOpenRouterKey || process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const referer = process.env.OPENROUTER_HTTP_REFERER || process.env.VITE_SITE_URL;
  const title = process.env.OPENROUTER_APP_TITLE || "Skleanings";

  return new OpenAI({
    apiKey: key,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      ...(referer ? { "HTTP-Referer": referer } : {}),
      ...(title ? { "X-Title": title } : {}),
    },
  });
}

export interface OpenRouterModelInfo {
  id: string;
  name?: string;
  contextLength?: number | null;
}

export async function listOpenRouterModels(apiKey?: string): Promise<OpenRouterModelInfo[]> {
  const key = apiKey || runtimeOpenRouterKey || process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("API key is required");
  }

  const referer = process.env.OPENROUTER_HTTP_REFERER || process.env.VITE_SITE_URL;
  const title = process.env.OPENROUTER_APP_TITLE || "Skleanings";

  const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${key}`,
      ...(referer ? { "HTTP-Referer": referer } : {}),
      ...(title ? { "X-Title": title } : {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `OpenRouter error (${response.status})`;
    throw new Error(message);
  }

  const list = Array.isArray(data?.data) ? data.data : [];
  return list
    .map((item: any) => ({
      id: String(item?.id || "").trim(),
      name: typeof item?.name === "string" ? item.name : undefined,
      contextLength: typeof item?.context_length === "number" ? item.context_length : null,
    }))
    .filter((item: OpenRouterModelInfo) => Boolean(item.id))
    .sort((a: OpenRouterModelInfo, b: OpenRouterModelInfo) => a.id.localeCompare(b.id));
}
