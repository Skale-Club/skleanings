/**
 * Storage layer — assembled from domain-specific modules.
 * All external consumers import from '../storage' which re-exports this.
 */
import * as users from "./users";
import * as catalog from "./catalog";
import * as bookings from "./bookings";
import * as company from "./company";
import * as integrations from "./integrations";
import * as chat from "./chat";
import * as blog from "./blog";
import * as timeSlots from "./time-slots";
import * as contacts from "./contacts";
import * as staff from "./staff";
import { db } from "../db";
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from "@shared/schema";
import { sql } from "drizzle-orm";

// ─── Schema ensure helpers (module-level singletons) ─────────────────────────
// WARNING: These execute DDL (ALTER TABLE) — only run via scripts, not serverless.

let chatSchemaEnsured = false;
let companySchemaEnsured = false;
let conversationSchemaEnsured = false;

async function ensureChatSchema(): Promise<void> {
  if (chatSchemaEnsured) return;
  try {
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "enabled" boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "agent_name" text DEFAULT 'Assistant'`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "agent_avatar_url" text DEFAULT ''`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "active_provider" text DEFAULT 'openai'`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "language_selector_enabled" boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "default_language" text DEFAULT 'en'`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "welcome_message" text DEFAULT 'Hi! How can I help you today?'`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "system_prompt" text DEFAULT 'You are our helpful chat assistant.'`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_provider" text DEFAULT 'gohighlevel'`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_id" text DEFAULT ''`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_staff" jsonb DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "intake_objectives" jsonb DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "excluded_url_rules" jsonb DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "show_in_prod" boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "use_knowledge_base" boolean DEFAULT true`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "use_faqs" boolean DEFAULT true`);
    await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now()`);
    chatSchemaEnsured = true;
  } catch (err) {
    console.error("ensureChatSchema error:", err);
  }
}

async function ensureCompanySchema(): Promise<void> {
  if (companySchemaEnsured) return;
  try {
    await db.execute(sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "time_zone" text DEFAULT 'America/New_York'`);
    await db.execute(sql.raw(`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "business_hours" jsonb DEFAULT '${JSON.stringify(DEFAULT_BUSINESS_HOURS)}'`));
    companySchemaEnsured = true;
  } catch (err) {
    console.error("ensureCompanySchema error:", err);
  }
}

async function ensureConversationSchema(): Promise<void> {
  if (conversationSchemaEnsured) return;
  try {
    await db.execute(sql`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "memory" jsonb DEFAULT '{}'`);
    await db.execute(sql`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "visitor_address" text`);
    await db.execute(sql`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "visitor_zipcode" text`);
    await db.execute(sql`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "last_message" text`);
    await db.execute(sql`
      UPDATE conversations c
      SET last_message = (
        SELECT cm.content FROM conversation_messages cm
        WHERE cm.conversation_id = c.id
        ORDER BY cm.created_at DESC LIMIT 1
      )
      WHERE c.last_message IS NULL
        AND EXISTS (SELECT 1 FROM conversation_messages cm WHERE cm.conversation_id = c.id)
    `);
    conversationSchemaEnsured = true;
  } catch (err) {
    console.error("ensureConversationSchema error:", err);
  }
}

async function initializeRuntimeState(): Promise<void> {
  await Promise.all([ensureChatSchema(), ensureCompanySchema(), ensureConversationSchema()]);
}

// ─── Assembled storage object ─────────────────────────────────────────────────

export const storage = {
  ...users,
  ...catalog,
  ...bookings,
  ...company,
  ...integrations,
  ...chat,
  ...blog,
  ...timeSlots,
  ...contacts,
  ...staff,
  initializeRuntimeState,
};

// Re-export types that other modules import from storage
export type { InsertSubcategory } from "./catalog";
export { insertSubcategorySchema } from "./catalog";
