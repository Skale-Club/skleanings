import { db } from "../db";
import {
  chatSettings, chatIntegrations, twilioSettings, telegramSettings,
  conversations, conversationMessages,
  type ChatSettings, type ChatIntegrations, type TwilioSettings, type TelegramSettings,
  type Conversation, type ConversationMessage,
  type InsertChatSettings, type InsertChatIntegrations, type InsertTwilioSettings,
  type InsertTelegramSettings, type InsertConversation, type InsertConversationMessage,
} from "@shared/schema";
import { eq, and, or, ne, asc, desc, sql } from "drizzle-orm";

// ─── Chat Settings ────────────────────────────────────────────────────────────

export async function getChatSettings(): Promise<ChatSettings> {
  const [settings] = await db.select().from(chatSettings).limit(1);
  if (settings) return settings;

  try {
    const [created] = await db.insert(chatSettings).values({}).returning();
    if (!created) throw new Error("Failed to create default chat settings");
    console.log("Created default chat settings row");
    return created;
  } catch (insertErr: any) {
    if (insertErr.message?.includes("duplicate") || insertErr.code === '23505') {
      const [settings] = await db.select().from(chatSettings).limit(1);
      if (settings) return settings;
    }
    throw insertErr;
  }
}

export async function updateChatSettings(settings: Partial<InsertChatSettings>): Promise<ChatSettings> {
  const existing = await getChatSettings();
  const [updated] = await db.update(chatSettings)
    .set({ ...settings, updatedAt: new Date() })
    .where(eq(chatSettings.id, existing.id))
    .returning();
  return updated;
}

// ─── Chat Integrations ────────────────────────────────────────────────────────

export async function getChatIntegration(provider: string): Promise<ChatIntegrations | undefined> {
  const normalizedProvider = (provider || "openai").trim().toLowerCase();
  const [integration] = await db.select().from(chatIntegrations)
    .where(eq(chatIntegrations.provider, normalizedProvider))
    .orderBy(desc(chatIntegrations.updatedAt), desc(chatIntegrations.id))
    .limit(1);
  return integration;
}

export async function upsertChatIntegration(settings: InsertChatIntegrations): Promise<ChatIntegrations> {
  const provider = (settings.provider || "openai").trim().toLowerCase();
  const existing = await getChatIntegration(provider);
  if (existing) {
    const payload = {
      ...settings,
      provider,
      apiKey: settings.apiKey ?? existing.apiKey,
      updatedAt: new Date(),
    };
    await db.update(chatIntegrations).set(payload).where(eq(chatIntegrations.provider, provider));
    const updated = await getChatIntegration(provider);
    if (!updated) throw new Error(`Failed to update chat integration for provider ${provider}`);
    return updated;
  }
  const [created] = await db.insert(chatIntegrations).values({ ...settings, provider }).returning();
  return created;
}

// ─── Twilio / Telegram ────────────────────────────────────────────────────────

export async function getTwilioSettings(): Promise<TwilioSettings | undefined> {
  const [settings] = await db.select().from(twilioSettings).limit(1);
  return settings;
}

export async function saveTwilioSettings(settings: InsertTwilioSettings): Promise<TwilioSettings> {
  const existing = await getTwilioSettings();
  if (existing) {
    const [updated] = await db.update(twilioSettings)
      .set({ ...settings, authToken: settings.authToken ?? existing.authToken, updatedAt: new Date() })
      .where(eq(twilioSettings.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db.insert(twilioSettings).values(settings).returning();
  return created;
}

export async function getTelegramSettings(): Promise<TelegramSettings | undefined> {
  const [settings] = await db.select().from(telegramSettings).limit(1);
  return settings;
}

export async function saveTelegramSettings(settings: InsertTelegramSettings): Promise<TelegramSettings> {
  const existing = await getTelegramSettings();
  if (existing) {
    const [updated] = await db.update(telegramSettings)
      .set({ ...settings, botToken: settings.botToken ?? existing.botToken, updatedAt: new Date() })
      .where(eq(telegramSettings.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db.insert(telegramSettings).values(settings).returning();
  return created;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
  const lastMessageExpr = sql<string | null>`COALESCE(
    ${conversations.lastMessage},
    (
      SELECT ${conversationMessages.content}
      FROM ${conversationMessages}
      WHERE ${conversationMessages.conversationId} = ${conversations.id}
      ORDER BY ${conversationMessages.createdAt} DESC
      LIMIT 1
    )
  )`;

  return await db.select({
    id: conversations.id,
    status: conversations.status,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
    lastMessageAt: conversations.lastMessageAt,
    firstPageUrl: conversations.firstPageUrl,
    visitorName: conversations.visitorName,
    visitorPhone: conversations.visitorPhone,
    visitorEmail: conversations.visitorEmail,
    visitorAddress: conversations.visitorAddress,
    visitorZipcode: conversations.visitorZipcode,
    lastMessage: lastMessageExpr,
    memory: conversations.memory,
  })
    .from(conversations)
    .orderBy(desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`));
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
  return conversation;
}

export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
  const [updated] = await db.update(conversations)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return updated;
}

export async function deleteConversation(id: string): Promise<void> {
  await db.delete(conversationMessages).where(eq(conversationMessages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
}

export async function createConversation(conversation: InsertConversation): Promise<Conversation> {
  const [created] = await db.insert(conversations).values(conversation).returning();
  return created;
}

export async function addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
  const [created] = await db.insert(conversationMessages).values(message).returning();
  await updateConversation(message.conversationId, {
    lastMessage: message.content,
    lastMessageAt: new Date(),
  });
  return created;
}

export async function getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  return await db.select().from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt));
}

export async function findOpenConversationByContact(
  phone?: string,
  email?: string,
  excludeId?: string,
): Promise<Conversation | undefined> {
  if (!phone && !email) return undefined;

  const conditions: any[] = [eq(conversations.status, 'open')];
  const contactConditions: any[] = [];
  if (phone) contactConditions.push(eq(conversations.visitorPhone, phone));
  if (email) contactConditions.push(eq(conversations.visitorEmail, email));
  conditions.push(or(...contactConditions));
  if (excludeId) conditions.push(ne(conversations.id, excludeId));

  const [existing] = await db.select().from(conversations)
    .where(and(...conditions))
    .orderBy(desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`))
    .limit(1);
  return existing;
}
