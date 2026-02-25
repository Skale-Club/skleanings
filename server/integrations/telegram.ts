import type { TelegramSettings } from "@shared/schema";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const TELEGRAM_MASK = "********";
const TELEGRAM_BOT_TOKEN_REGEX = /^\d+:[A-Za-z0-9_-]+$/;

type BookingNotificationPayload = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  customerAddress?: string;
  bookingDate?: string;
  startTime?: string;
  totalPrice?: string | number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
  pageUrl?: string
): Promise<{ success: boolean; message?: string }> {
  if (!settings.enabled || !settings.notifyOnNewChat) {
    return { success: false, message: "Telegram new chat notifications are disabled" };
  }

  const message =
    `<b>New chat started</b>\n` +
    `<b>Conversation:</b> <code>${escapeHtml(conversationId.slice(0, 8))}...</code>\n` +
    `<b>Page:</b> ${escapeHtml(pageUrl || "Unknown")}`;

  return sendMessageToAll(settings, message, "HTML");
}

export async function sendBookingNotification(
  booking: BookingNotificationPayload,
  serviceNames: string[],
  settings: TelegramSettings
): Promise<{ success: boolean; message?: string }> {
  if (!settings.enabled) {
    return { success: false, message: "Telegram notifications are disabled" };
  }

  const serviceList = serviceNames.length > 0 ? serviceNames.map((name) => `- ${escapeHtml(name)}`).join("\n") : "- N/A";
  const message =
    `<b>New booking confirmed</b>\n` +
    `<b>Customer:</b> ${escapeHtml(booking.customerName || "N/A")}\n` +
    `<b>Phone:</b> ${escapeHtml(booking.customerPhone || "N/A")}\n` +
    `<b>Email:</b> ${escapeHtml(booking.customerEmail || "N/A")}\n` +
    `<b>Date:</b> ${escapeHtml(booking.bookingDate || "N/A")}\n` +
    `<b>Time:</b> ${escapeHtml(booking.startTime || "N/A")}\n` +
    `<b>Address:</b> ${escapeHtml(booking.customerAddress || "N/A")}\n` +
    `<b>Total:</b> $${escapeHtml(String(booking.totalPrice ?? "N/A"))}\n\n` +
    `<b>Service(s):</b>\n${serviceList}`;

  return sendMessageToAll(settings, message, "HTML");
}

export async function sendTelegramTestMessage(
  settings: TelegramSettings
): Promise<{ success: boolean; message?: string }> {
  if (!hasTelegramCredentials(settings)) {
    return { success: false, message: "Bot token and at least one chat ID are required" };
  }

  const forcedSettings: TelegramSettings = { ...settings, enabled: true };
  const message =
    `<b>Telegram integration test</b>\n` +
    `Your bot token and chat IDs are configured correctly.\n` +
    `<b>Time:</b> ${escapeHtml(new Date().toISOString())}`;

  return sendMessageToAll(forcedSettings, message, "HTML");
}
