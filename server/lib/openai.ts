
import { OpenAI } from "openai";

export const DEFAULT_CHAT_MODEL = "gpt-4o";

let runtimeOpenAiKey = process.env.OPENAI_API_KEY || "";

export function getRuntimeOpenAiKey() {
    return runtimeOpenAiKey;
}

export function setRuntimeOpenAiKey(key: string) {
    runtimeOpenAiKey = key;
}

export function getOpenAIClient(apiKey?: string) {
    const key = apiKey || runtimeOpenAiKey || process.env.OPENAI_API_KEY;
    if (!key) return null;
    return new OpenAI({ apiKey: key });
}
