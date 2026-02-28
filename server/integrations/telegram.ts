import type { TelegramSettings } from "@shared/schema";
import {
  type BookingNotificationPayload,
  buildBookingNotification,
  buildNewChatNotification,
  renderNotificationHtml,
} from "../lib/notification-templates";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const TELEGRAM_MASK = "********";
const TELEGRAM_BOT_TOKEN_REGEX = /^\d+:[A-Za-z0-9_-]+$/;

function splitForTelegram(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
    return [text];
  }

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
      parts.push(remaining);
      break;
    }

    const chunk = remaining.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH);
    const breakAt = chunk.lastIndexOf("\n");
    if (breakAt > 0) {
      parts.push(chunk.slice(0, breakAt));
      remaining = remaining.slice(breakAt + 1);
    } else {
      parts.push(chunk);
      remaining = remaining.slice(TELEGRAM_MAX_MESSAGE_LENGTH);
    }
  }

  return parts.filter(Boolean);
}

export function maskToken(token?: string | null): string {
  return token ? TELEGRAM_MASK : "";
}

export function isMaskedToken(token?: string | null): boolean {
  return token === TELEGRAM_MASK;
}

export function isValidTelegramBotToken(token?: string | null): boolean {
  if (!token) return false;
  return TELEGRAM_BOT_TOKEN_REGEX.test(token.trim());
}

export function hasTelegramCredentials(settings?: Partial<TelegramSettings> | null): boolean {
  if (!settings) return false;
  return Boolean(settings.botToken) && Array.isArray(settings.chatIds) && settings.chatIds.length > 0;
}

async function sendSingleMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: "HTML" | "MarkdownV2" = "HTML"
): Promise<void> {
  const normalizedText = text.normalize("NFC");

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      chat_id: chatId,
      text: normalizedText,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    const description = data?.description || `Telegram API error (${response.status})`;
    throw new Error(description);
  }
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: "HTML" | "MarkdownV2" = "HTML"
): Promise<{ success: boolean; message?: string }> {
  try {
    const chunks = splitForTelegram(text);
    for (const chunk of chunks) {
      await sendSingleMessage(botToken, chatId, chunk, parseMode);
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to send Telegram message" };
  }
}

export async function sendMessageToAll(
  settings: TelegramSettings,
  text: string,
  parseMode: "HTML" | "MarkdownV2" = "HTML"
): Promise<{ success: boolean; message?: string }> {
  if (!settings.enabled) {
    return { success: false, message: "Telegram notifications are disabled" };
  }

  if (!hasTelegramCredentials(settings)) {
    return { success: false, message: "Telegram settings are incomplete" };
  }

  const failures: string[] = [];
  const chatIds = settings.chatIds || [];

  for (const chatId of chatIds) {
    const result = await sendTelegramMessage(settings.botToken as string, chatId, text, parseMode);
    if (!result.success) {
      failures.push(`${chatId}: ${result.message || "unknown error"}`);
    }
  }

  if (failures.length > 0) {
    return {
      success: false,
      message: `Failed to send to ${failures.length} chat(s): ${failures.join(" | ")}`,
    };
  }

  return { success: true };
}

export async function sendNewChatNotification(
  settings: TelegramSettings,
  conversationId: string,
  pageUrl?: string,
  companyName?: string
): Promise<{ success: boolean; message?: string }> {
  if (!settings.enabled || !settings.notifyOnNewChat) {
    return { success: false, message: "Telegram new chat notifications are disabled" };
  }

  const message = renderNotificationHtml(
    buildNewChatNotification(conversationId, pageUrl, companyName)
  );

  return sendMessageToAll(settings, message, "HTML");
}

export async function sendBookingNotification(
  booking: BookingNotificationPayload,
  serviceNames: string[],
  settings: TelegramSettings,
  companyName?: string
): Promise<{ success: boolean; message?: string }> {
  if (!settings.enabled) {
    return { success: false, message: "Telegram notifications are disabled" };
  }

  const message = renderNotificationHtml(
    buildBookingNotification(booking, serviceNames, companyName)
  );

  return sendMessageToAll(settings, message, "HTML");
}

export async function sendTelegramTestMessage(
  settings: TelegramSettings,
  companyName?: string
): Promise<{ success: boolean; message?: string }> {
  if (!hasTelegramCredentials(settings)) {
    return { success: false, message: "Bot token and at least one chat ID are required" };
  }

  const forcedSettings: TelegramSettings = { ...settings, enabled: true };
  const resolvedCompanyName = (companyName || "the business").trim() || "the business";
  const escapedCompanyName = resolvedCompanyName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const message = [
    `<b>Telegram integration test - ${escapedCompanyName}</b>`,
    `Your bot token and chat IDs are configured correctly.`,
    `<b>Time:</b> ${new Date().toISOString()}`,
    `<b>Company:</b> ${escapedCompanyName}`,
  ].join("\n");

  return sendMessageToAll(forcedSettings, message, "HTML");
}
