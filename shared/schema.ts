import { pgTable, text, serial, integer, numeric, timestamp, boolean, date, jsonb, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models (required for Replit Auth)
export * from "./models/auth";


// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  profileImageUrl: text("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  role: text("role").notNull().default("viewer"), // 'admin' | 'staff' | 'viewer'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export const insertUserSchema = createInsertSchema(users);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"), // For category card
  order: integer("order").default(0),
});

export const subcategories = pgTable("subcategories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

// Pricing type options for services
export type PricingType = 'fixed_item' | 'area_based' | 'base_plus_addons' | 'custom_quote';

// Area size preset for area_based pricing
export interface AreaSizePreset {
  name: string;        // e.g., "Small Room", "Medium Room"
  sqft: number | null; // Square footage (null for custom input option)
  price: number;       // Fixed price for this preset
}

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // Fixed price (for fixed_item type)
  durationMinutes: integer("duration_minutes").notNull(), // Duration in minutes
  imageUrl: text("image_url"),
  isHidden: boolean("is_hidden").default(false), // Hidden services only appear as add-ons
  isArchived: boolean("is_archived").default(false), // Soft delete flag
  showOnLanding: boolean("show_on_landing").default(true), // Show/hide on landing page homepage
  order: integer("order").default(0),
  // New pricing fields
  pricingType: text("pricing_type").default("fixed_item"), // 'fixed_item' | 'area_based' | 'base_plus_addons' | 'custom_quote'
  basePrice: numeric("base_price", { precision: 10, scale: 2 }), // Base price for base_plus_addons
  pricePerUnit: numeric("price_per_unit", { precision: 10, scale: 2 }), // Price per sq ft for area_based (custom input)
  minimumPrice: numeric("minimum_price", { precision: 10, scale: 2 }), // Minimum price for area_based and custom_quote
  areaSizes: jsonb("area_sizes").$type<AreaSizePreset[]>(), // Preset sizes for area_based pricing
  // Booking limits fields (Phase 21)
  bufferTimeBefore: integer("buffer_time_before").default(0).notNull(),
  bufferTimeAfter: integer("buffer_time_after").default(0).notNull(),
  minimumNoticeHours: integer("minimum_notice_hours").default(0).notNull(),
  timeSlotInterval: integer("time_slot_interval"), // nullable — null = use durationMinutes
  requiresConfirmation: boolean("requires_confirmation").default(false).notNull(),
});

// Service add-on relationships (e.g., Sofa can suggest Ottoman as add-on)
export const serviceAddons = pgTable("service_addons", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(), // The main service
  addonServiceId: integer("addon_service_id").references(() => services.id).notNull(), // The add-on service
});

// Service options for base_plus_addons pricing (e.g., Extra Bedroom +$20)
export const serviceOptions = pgTable("service_options", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  name: text("name").notNull(), // e.g., "Extra Bedroom"
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // e.g., 20.00
  maxQuantity: integer("max_quantity").default(10), // Max quantity per option
  order: integer("order").default(0),
});

// Service frequencies for base_plus_addons pricing (e.g., Weekly - 15% discount)
export const serviceFrequencies = pgTable("service_frequencies", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  name: text("name").notNull(), // e.g., "Weekly", "Every 15 days"
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"), // e.g., 15.00 for 15%
  order: integer("order").default(0),
  intervalDays: integer("interval_days").notNull().default(7), // Phase 28 RECUR-01: days between bookings
});

// Service duration options (Phase 23 SEED-029)
// When a service has rows here, the booking flow shows a duration selector.
export const serviceDurations = pgTable("service_durations", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(), // e.g., "2 hours — Small apartment"
  durationMinutes: integer("duration_minutes").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  order: integer("order").notNull().default(0),
});

// Customer contacts — deduplicated across bookings by email (primary) or phone (fallback)
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  address: text("address"),
  ghlContactId: text("ghl_contact_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type UserRole = 'admin' | 'staff' | 'viewer';

// === MARKETING ATTRIBUTION TABLES (Phase 10) ===

// visitor_sessions: one row per anonymous visitor (UUID from client localStorage).
// first_* columns: written ONCE on INSERT, NEVER updated (CAPTURE-05 invariant).
// last_* columns: updated only when request has UTM params or external referrer (D-02).
export const visitorSessions = pgTable("visitor_sessions", {
  id: uuid("id").primaryKey(),
  // First-touch attribution (immutable after INSERT)
  firstUtmSource:     text("first_utm_source"),
  firstUtmMedium:     text("first_utm_medium"),
  firstUtmCampaign:   text("first_utm_campaign"),
  firstUtmTerm:       text("first_utm_term"),
  firstUtmContent:    text("first_utm_content"),
  firstUtmId:         text("first_utm_id"),
  firstLandingPage:   text("first_landing_page"),
  firstReferrer:      text("first_referrer"),
  firstTrafficSource: text("first_traffic_source").notNull().default("unknown"),
  firstSeenAt:        timestamp("first_seen_at").defaultNow().notNull(),
  // Last-touch attribution (updated on meaningful re-engagement)
  lastUtmSource:      text("last_utm_source"),
  lastUtmMedium:      text("last_utm_medium"),
  lastUtmCampaign:    text("last_utm_campaign"),
  lastUtmTerm:        text("last_utm_term"),
  lastUtmContent:     text("last_utm_content"),
  lastUtmId:          text("last_utm_id"),
  lastLandingPage:    text("last_landing_page"),
  lastReferrer:       text("last_referrer"),
  lastTrafficSource:  text("last_traffic_source").notNull().default("unknown"),
  lastSeenAt:         timestamp("last_seen_at").defaultNow().notNull(),
  // Aggregate counters
  visitCount:    integer("visit_count").notNull().default(1),
  totalBookings: integer("total_bookings").notNull().default(0),
  convertedAt:   timestamp("converted_at"),
}, (table) => ({
  firstUtmSourceIdx:     index("visitor_sessions_first_utm_source_idx").on(table.firstUtmSource),
  firstTrafficSourceIdx: index("visitor_sessions_first_traffic_source_idx").on(table.firstTrafficSource),
  firstSeenAtIdx:        index("visitor_sessions_first_seen_at_idx").on(table.firstSeenAt),
  lastSeenAtIdx:         index("visitor_sessions_last_seen_at_idx").on(table.lastSeenAt),
  firstCampaignIdx:      index("visitor_sessions_first_campaign_idx").on(table.firstUtmCampaign),
}));

export type VisitorSession = typeof visitorSessions.$inferSelect;
export const insertVisitorSessionSchema = createInsertSchema(visitorSessions);
export type InsertVisitorSession = z.infer<typeof insertVisitorSessionSchema>;

// Recurring subscription records — one row per customer recurring schedule (Phase 27 RECUR-01)
// Must be defined before bookings because bookings.recurringBookingId references this table.
export const recurringBookings = pgTable("recurring_bookings", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  serviceId: integer("service_id").references(() => services.id, { onDelete: "restrict" }).notNull(),
  serviceFrequencyId: integer("service_frequency_id").references(() => serviceFrequencies.id, { onDelete: "restrict" }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  intervalDays: integer("interval_days").notNull(), // snapshot: 7 | 14 | 30
  frequencyName: text("frequency_name").notNull(),  // snapshot of serviceFrequencies.name at creation
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  nextBookingDate: date("next_booking_date").notNull(),
  preferredStartTime: text("preferred_start_time").notNull(),
  preferredStaffMemberId: integer("preferred_staff_member_id").references(() => staffMembers.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"), // active | paused | cancelled
  cancelledAt: timestamp("cancelled_at"),
  pausedAt: timestamp("paused_at"),
  // IMPORTANT: Do NOT add .references(() => bookings.id) to originBookingId — this would create
  // a circular reference in Drizzle (bookings is defined after this table). The SQL migration
  // enforces the FK constraint at DB level. Use plain integer() only here.
  originBookingId: integer("origin_booking_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRecurringBookingSchema = createInsertSchema(recurringBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  pausedAt: true,
});
export type RecurringBooking = typeof recurringBookings.$inferSelect;
export type InsertRecurringBooking = z.infer<typeof insertRecurringBookingSchema>;

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  bookingDate: date("booking_date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(), // HH:MM, calculated from duration
  totalDurationMinutes: integer("total_duration_minutes").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // "site" or "online"
  paymentStatus: text("payment_status").notNull().default("unpaid"), // paid, unpaid
  status: text("status").notNull().default("pending"), // pending, confirmed, cancelled, completed
  createdAt: timestamp("created_at").defaultNow(),
  // GHL integration fields
  ghlAppointmentId: text("ghl_appointment_id"),
  ghlContactId: text("ghl_contact_id"),
  ghlSyncStatus: text("ghl_sync_status").default("pending"), // pending, synced, failed
  // Staff assignment (nullable — single-operator deployments have no staff selection)
  staffMemberId: integer("staff_member_id").references(() => staffMembers.id, { onDelete: "set null" }),
  // Client ownership (nullable — guest bookings have no userId)
  userId: text("user_id").references(() => users.id),
  // Stripe payment fields (nullable — only set for online payments)
  stripeSessionId: text("stripe_session_id"),
  stripePaymentStatus: text("stripe_payment_status"), // paid, unpaid, no_payment_required
  // Contact link (nullable — backfilled from existing bookings via migration)
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  // UTM attribution FK (Phase 10 — nullable; populated by analytics hook)
  utmSessionId: uuid("utm_session_id").references(() => visitorSessions.id, { onDelete: "set null" }),
  // Recurring subscription link — null for one-time bookings, set for cron-generated bookings (Phase 27)
  recurringBookingId: integer("recurring_booking_id").references(() => recurringBookings.id, { onDelete: "set null" }),
});

// conversion_events: one row per tracked action (booking_completed, booking_started, chat_initiated).
// Denormalized attribution snapshot at event time — no JOIN needed for reports.
export const conversionEvents = pgTable("conversion_events", {
  id:           serial("id").primaryKey(),
  visitorId:    uuid("visitor_id").references(() => visitorSessions.id, { onDelete: "set null" }),
  eventType:    text("event_type").notNull(),
  // eventType: 'booking_completed' | 'booking_started' | 'chat_initiated'
  bookingId:    integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  bookingValue: numeric("booking_value", { precision: 10, scale: 2 }),
  // Denormalized attribution snapshot
  attributedSource:      text("attributed_source"),
  attributedMedium:      text("attributed_medium"),
  attributedCampaign:    text("attributed_campaign"),
  attributedLandingPage: text("attributed_landing_page"),
  attributionModel:      text("attribution_model").notNull().default("last_touch"),
  // attributionModel: 'first_touch' | 'last_touch'
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  pageUrl:    text("page_url"),
  metadata:   jsonb("metadata").default({}),
}, (table) => ({
  // ATTR-03: prevent duplicate conversion rows (Stripe webhook + confirmation page race).
  // NOTE: This unique index is enforced as a PARTIAL index (WHERE booking_id IS NOT NULL)
  //       via the SQL migration only — Drizzle 0.39.3 cannot express a partial unique index
  //       in the table builder. The table builder uniqueIndex below is a placeholder for
  //       type-safety; the authoritative constraint lives in
  //       supabase/migrations/20260425000000_add_utm_tracking.sql.
  bookingEventModelUnique: uniqueIndex("conversion_events_booking_event_model_unique_idx")
    .on(table.bookingId, table.eventType, table.attributionModel),
  occurredAtIdx:         index("conversion_events_occurred_at_idx").on(table.occurredAt),
  eventTypeIdx:          index("conversion_events_event_type_idx").on(table.eventType),
  attributedSourceIdx:   index("conversion_events_attributed_source_idx").on(table.attributedSource),
  attributedCampaignIdx: index("conversion_events_attributed_campaign_idx").on(table.attributedCampaign),
  visitorIdIdx:          index("conversion_events_visitor_id_idx").on(table.visitorId),
  bookingIdIdx:          index("conversion_events_booking_id_idx").on(table.bookingId),
}));

export type ConversionEvent = typeof conversionEvents.$inferSelect;
export const insertConversionEventSchema = createInsertSchema(conversionEvents).omit({ id: true, occurredAt: true });
export type InsertConversionEvent = z.infer<typeof insertConversionEventSchema>;

// GoHighLevel Integration Settings
export const integrationSettings = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("gohighlevel"), // gohighlevel, etc.
  apiKey: text("api_key"), // Encrypted API key
  locationId: text("location_id"),
  calendarId: text("calendar_id").default(""),
  isEnabled: boolean("is_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat Settings (singleton table - only one row)
export const chatSettings = pgTable("chat_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  agentName: text("agent_name").default("Assistant"),
  agentAvatarUrl: text("agent_avatar_url").default(""),
  activeProvider: text("active_provider").default("openai"), // openai, gemini
  avgResponseTime: text("avg_response_time").default(""),
  languageSelectorEnabled: boolean("language_selector_enabled").default(false),
  defaultLanguage: text("default_language").default("en"),
  systemPrompt: text("system_prompt").default(
    "You are our helpful chat assistant. Provide concise, friendly answers. Use the provided tools to fetch services, details, and availability. Do not guess prices or availability; always use tool data when relevant. If booking is requested, gather details and direct the user to the booking page at /booking."
  ),
  welcomeMessage: text("welcome_message").default("Hi! How can I help you today?"),
  calendarProvider: text("calendar_provider").default("gohighlevel"),
  calendarId: text("calendar_id").default(""),
  calendarStaff: jsonb("calendar_staff").default([]),
  intakeObjectives: jsonb("intake_objectives").default([]),
  excludedUrlRules: jsonb("excluded_url_rules").default([]),
  useKnowledgeBase: boolean("use_knowledge_base").default(true),
  useFaqs: boolean("use_faqs").default(true),
  showInProd: boolean("show_in_prod").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat Integrations (OpenAI)
export const chatIntegrations = pgTable("chat_integrations", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("openai"),
  enabled: boolean("enabled").default(false),
  model: text("model").default("gpt-4o-mini"),
  apiKey: text("api_key"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Twilio Integration Settings
export const twilioSettings = pgTable("twilio_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  accountSid: text("account_sid"),
  authToken: text("auth_token"),
  fromPhoneNumber: text("from_phone_number"),
  toPhoneNumbers: text("to_phone_numbers").array().notNull().default(sql`ARRAY[]::text[]`),
  notifyOnNewChat: boolean("notify_on_new_chat").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Telegram Integration Settings
export const telegramSettings = pgTable("telegram_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  botToken: text("bot_token"),
  chatIds: text("chat_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  notifyOnNewChat: boolean("notify_on_new_chat").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Heartbeat log table for keep-alive cron runs
export const systemHeartbeats = pgTable("system_heartbeats", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().default("vercel-cron"),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastMessageAt: timestamp("last_message_at"),
  firstPageUrl: text("first_page_url"),
  visitorName: text("visitor_name"),
  visitorPhone: text("visitor_phone"),
  visitorEmail: text("visitor_email"),
  visitorAddress: text("visitor_address"),
  visitorZipcode: text("visitor_zipcode"),
  lastMessage: text("last_message"),
  memory: jsonb("memory").default({}),
});

// Structured memory for conversation state tracking
export interface ConversationMemory {
  // Service info
  selectedService?: {
    id: number;
    name: string;
    price: string;
    durationMinutes: number;
  };
  // Collected data (matches intake flow)
  collectedData: {
    zipcode?: string;
    serviceType?: string;
    serviceDetails?: string;
    preferredDate?: string;
    selectedDate?: string;
    selectedTime?: string;
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  // Current step in intake flow
  currentStep?: string;
  // Steps already completed
  completedSteps: string[];
  // Reasoning/thinking from last interaction
  lastReasoning?: string;
}

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
});

// Selected option snapshot for booking items
export interface BookingItemOption {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

// Selected frequency snapshot for booking items
export interface BookingItemFrequency {
  id: number;
  name: string;
  discountPercent: number;
}

// Price breakdown for audit trail
export interface PriceBreakdown {
  basePrice?: number;
  areaPrice?: number;
  optionsTotal?: number;
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  finalPrice: number;
}

export const bookingItems = pgTable("booking_items", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  serviceName: text("service_name").notNull(), // Snapshot in case service changes
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // Snapshot price (final calculated price)
  quantity: integer("quantity").default(1), // Quantity of service
  // New fields for different pricing types
  pricingType: text("pricing_type").default("fixed_item"), // Snapshot of service pricing type
  areaSize: text("area_size"), // e.g., "Medium Room" or "Custom: 250 sqft"
  areaValue: numeric("area_value", { precision: 10, scale: 2 }), // Actual sqft value if custom
  selectedOptions: jsonb("selected_options").$type<BookingItemOption[]>(), // Options selected
  selectedFrequency: jsonb("selected_frequency").$type<BookingItemFrequency>(), // Frequency selected
  customerNotes: text("customer_notes"), // Notes for custom_quote
  priceBreakdown: jsonb("price_breakdown").$type<PriceBreakdown>(), // Detailed price calculation
});

// === SCHEMAS ===

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertSubcategorySchema = createInsertSchema(subcategories).omit({ id: true });
// Custom zod schema for AreaSizePreset
const areaSizePresetSchema = z.object({
  name: z.string(),
  sqft: z.number().nullable(),
  price: z.number(),
});

export const insertServiceSchema = createInsertSchema(services, {
  // Override areaSizes to use proper zod schema
  areaSizes: z.array(areaSizePresetSchema).optional().nullable(),
}).omit({ id: true });
export const insertServiceAddonSchema = createInsertSchema(serviceAddons).omit({ id: true });
export const insertServiceOptionSchema = createInsertSchema(serviceOptions).omit({ id: true });
export const insertServiceFrequencySchema = createInsertSchema(serviceFrequencies).omit({ id: true });
export const insertServiceDurationSchema = createInsertSchema(serviceDurations).omit({ id: true });
// Cart item data sent from frontend for booking
export const cartItemSchema = z.object({
  serviceId: z.number(),
  quantity: z.number().default(1),
  // For area_based
  areaSize: z.string().optional(), // Preset name or "custom"
  areaValue: z.number().optional(), // Custom sqft value
  // For base_plus_addons
  selectedOptions: z.array(z.object({
    optionId: z.number(),
    quantity: z.number().default(1),
  })).optional(),
  selectedFrequencyId: z.number().optional(),
  // For custom_quote
  customerNotes: z.string().optional(),
});

export type CartItemData = z.infer<typeof cartItemSchema>;

export const insertBookingSchemaBase = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  status: true,
  ghlAppointmentId: true,
  ghlContactId: true,
  ghlSyncStatus: true,
  userId: true,
}).extend({
  // Frontend sends cart items with all pricing details (new format)
  cartItems: z.array(cartItemSchema).optional(),
  // Legacy support: serviceIds can still be used for simple fixed_item bookings
  serviceIds: z.array(z.number()).optional(),
  bookingDate: z.string(), // Provide as string YYYY-MM-DD
});

export const insertBookingSchema = insertBookingSchemaBase.refine(
  (data) => (data.cartItems && data.cartItems.length > 0) || (data.serviceIds && data.serviceIds.length > 0),
  { message: "Select at least one service (either cartItems or serviceIds required)" }
);
export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export const insertChatSettingsSchema = createInsertSchema(chatSettings).omit({
  id: true,
  updatedAt: true,
});
export const insertChatIntegrationsSchema = createInsertSchema(chatIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTwilioSettingsSchema = createInsertSchema(twilioSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  toPhoneNumbers: z.array(z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format (e.g., +15551234567)")).min(1, "At least one phone number is required"),
});
export const insertTelegramSettingsSchema = createInsertSchema(telegramSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  chatIds: z.array(z.string().min(1, "Chat ID cannot be empty")).default([]),
});
export const insertConversationSchema = createInsertSchema(conversations).omit({
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
});
export const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({
  createdAt: true,
});

// === TYPES ===

export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Service = typeof services.$inferSelect;
export type ServiceAddon = typeof serviceAddons.$inferSelect;
export type ServiceOption = typeof serviceOptions.$inferSelect;
export type ServiceFrequency = typeof serviceFrequencies.$inferSelect;
export type ServiceDuration = typeof serviceDurations.$inferSelect;
export type InsertServiceDuration = z.infer<typeof insertServiceDurationSchema>;
export type Booking = typeof bookings.$inferSelect;
export type BookingItem = typeof bookingItems.$inferSelect;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type ChatSettings = typeof chatSettings.$inferSelect;
export type ChatIntegrations = typeof chatIntegrations.$inferSelect;
export type TwilioSettings = typeof twilioSettings.$inferSelect;
export type TelegramSettings = typeof telegramSettings.$inferSelect;
export type SystemHeartbeat = typeof systemHeartbeats.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertServiceAddon = z.infer<typeof insertServiceAddonSchema>;
export type InsertServiceOption = z.infer<typeof insertServiceOptionSchema>;
export type InsertServiceFrequency = z.infer<typeof insertServiceFrequencySchema>;
// InsertServiceDuration is co-located with ServiceDuration type above (Phase 23)
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;
export type InsertChatSettings = z.infer<typeof insertChatSettingsSchema>;
export type InsertChatIntegrations = z.infer<typeof insertChatIntegrationsSchema>;
export type InsertTwilioSettings = z.infer<typeof insertTwilioSettingsSchema>;
export type InsertTelegramSettings = z.infer<typeof insertTelegramSettingsSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;

// For availability checking
export interface TimeSlot {
  time: string; // HH:MM
  available: boolean;
}

export const WORKING_HOURS = {
  start: 8, // 8 AM
  end: 18,  // 6 PM
};

// Day-by-day business hours type
export interface DayHours {
  isOpen: boolean;
  start: string; // HH:MM
  end: string;   // HH:MM
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface HomepageContent {
  brandColors?: {
    primary?: string;   // hex e.g. '#1C53A3'
    secondary?: string; // hex e.g. '#FFFF01'
  };
  heroBadgeImageUrl?: string;
  heroBadgeAlt?: string;
  trustBadges?: { title: string; description: string; icon?: string }[];
  categoriesSection?: { title?: string; subtitle?: string; ctaText?: string };
  reviewsSection?: { title?: string; subtitle?: string; embedUrl?: string };
  blogSection?: { title?: string; subtitle?: string; viewAllText?: string; readMoreText?: string };
  areasServedSection?: { label?: string; heading?: string; description?: string; ctaText?: string };
  footerSection?: {
    tagline?: string;
    companyLinks?: { label: string; href: string }[];
    resourceLinks?: { label: string; href: string }[];
  };
  aboutSection?: {
    heading?: string;
    intro?: string;
    features?: { title: string; desc: string }[];
    missionTitle?: string;
    missionText?: string;
  };
  teamSection?: {
    heading?: string;
    intro?: string;
    features?: { title: string; desc: string }[];
    whyChooseTitle?: string;
    whyChooseText?: string;
    stats?: { value: string; label: string }[];
  };
  serviceAreasPageSection?: {
    heading?: string;
    intro?: string;
    notFoundTitle?: string;
    notFoundText?: string;
  };
  faqPageSection?: {
    heading?: string;
    subtitle?: string;
  };
  blogPageSection?: {
    heading?: string;
    subtitle?: string;
  };
  confirmationSection?: {
    paidMessage?: string;
    sitePaymentMessage?: string;
  };
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { isOpen: true, start: '08:00', end: '18:00' },
  tuesday: { isOpen: true, start: '08:00', end: '18:00' },
  wednesday: { isOpen: true, start: '08:00', end: '18:00' },
  thursday: { isOpen: true, start: '08:00', end: '18:00' },
  friday: { isOpen: true, start: '08:00', end: '18:00' },
  saturday: { isOpen: false, start: '09:00', end: '14:00' },
  sunday: { isOpen: false, start: '09:00', end: '14:00' },
};

// Company Settings (singleton table - only one row)
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").default(''),
  industry: text("industry").default(''),
  companyEmail: text("company_email").default(''),
  companyPhone: text("company_phone").default(''),
  companyAddress: text("company_address").default(''),
  workingHoursStart: text("working_hours_start").default('08:00'),
  workingHoursEnd: text("working_hours_end").default('18:00'),
  logoMain: text("logo_main").default(''),
  logoDark: text("logo_dark").default(''),
  logoIcon: text("logo_icon").default(''),
  sectionsOrder: text("sections_order").array(),
  socialLinks: jsonb("social_links").default([]),
  mapEmbedUrl: text("map_embed_url").default(''),
  heroTitle: text("hero_title").default(''),
  heroSubtitle: text("hero_subtitle").default(''),
  heroImageUrl: text("hero_image_url").default(''),
  ctaText: text("cta_text").default('Book Now'),
  timeFormat: text("time_format").default('12h'), // '12h' or '24h'
  timeZone: text("time_zone").default('America/New_York'),
  businessHours: jsonb("business_hours"), // Day-by-day business hours
  minimumBookingValue: numeric("minimum_booking_value", { precision: 10, scale: 2 }).default('0'), // Minimum cart value required
  seoTitle: text("seo_title").default(''),
  seoDescription: text("seo_description").default(''),
  ogImage: text("og_image").default(''),
  // Extended SEO fields
  seoKeywords: text("seo_keywords").default(''),
  seoAuthor: text("seo_author").default(''),
  seoCanonicalUrl: text("seo_canonical_url").default(''),
  seoRobotsTag: text("seo_robots_tag").default('index, follow'),
  // Open Graph extended
  ogType: text("og_type").default('website'),
  ogSiteName: text("og_site_name").default(''),
  // Twitter Cards
  twitterCard: text("twitter_card").default('summary_large_image'),
  twitterSite: text("twitter_site").default(''),
  twitterCreator: text("twitter_creator").default(''),
  // Schema.org LocalBusiness
  schemaLocalBusiness: jsonb("schema_local_business").default({}),
  // Marketing Analytics
  gtmContainerId: text("gtm_container_id").default(''), // GTM-XXXXXXX
  ga4MeasurementId: text("ga4_measurement_id").default(''), // G-XXXXXXXXXX
  facebookPixelId: text("facebook_pixel_id").default(''), // Numeric ID
  gtmEnabled: boolean("gtm_enabled").default(false),
  ga4Enabled: boolean("ga4_enabled").default(false),
  facebookPixelEnabled: boolean("facebook_pixel_enabled").default(false),
  homepageContent: jsonb("homepage_content").$type<HomepageContent>().default({}),
  // === Phase 15: White-label columns ===
  serviceDeliveryModel: text("service_delivery_model").default('at-customer'),
  privacyPolicyContent: text("privacy_policy_content").default(''),
  termsOfServiceContent: text("terms_of_service_content").default(''),
  faviconUrl: text("favicon_url").default(''),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings, {
  homepageContent: z.custom<HomepageContent>().optional().nullable(),
}).omit({ id: true });
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

// FAQ table
export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
});

export const insertFaqSchema = createInsertSchema(faqs).omit({ id: true });
export type Faq = typeof faqs.$inferSelect;
export type InsertFaq = z.infer<typeof insertFaqSchema>;

// Service Area Groups table (regions/counties like "MetroWest", "Greater Boston")
export const serviceAreaGroups = pgTable("service_area_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "MetroWest", "Greater Boston"
  slug: text("slug").notNull().unique(),
  description: text("description"),
  order: integer("order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServiceAreaGroupSchema = createInsertSchema(serviceAreaGroups).omit({
  id: true,
  createdAt: true
});
export type ServiceAreaGroup = typeof serviceAreaGroups.$inferSelect;
export type InsertServiceAreaGroup = z.infer<typeof insertServiceAreaGroupSchema>;

// Service Area Cities table (cities within each area group)
export const serviceAreaCities = pgTable("service_area_cities", {
  id: serial("id").primaryKey(),
  areaGroupId: integer("area_group_id").references(() => serviceAreaGroups.id).notNull(),
  name: text("name").notNull(), // e.g., "Framingham", "Natick"
  zipcode: text("zipcode"),
  order: integer("order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServiceAreaCitySchema = createInsertSchema(serviceAreaCities).omit({
  id: true,
  createdAt: true
});
export type ServiceAreaCity = typeof serviceAreaCities.$inferSelect;
export type InsertServiceAreaCity = z.infer<typeof insertServiceAreaCitySchema>;

// Legacy Service Areas table (kept for backward compatibility during migration)
export const serviceAreas = pgTable("service_areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  zipcode: text("zipcode"),
  order: integer("order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServiceAreaSchema = createInsertSchema(serviceAreas).omit({
  id: true,
  createdAt: true
});
export type ServiceArea = typeof serviceAreas.$inferSelect;
export type InsertServiceArea = z.infer<typeof insertServiceAreaSchema>;

// Blog Posts table
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  metaDescription: text("meta_description"),
  focusKeyword: text("focus_keyword"),
  tags: text("tags"),
  featureImageUrl: text("feature_image_url"),
  status: text("status").notNull().default("draft"),
  authorName: text("author_name").default("Admin"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Junction table for blog posts and services (related products)
export const blogPostServices = pgTable("blog_post_services", {
  id: serial("id").primaryKey(),
  blogPostId: integer("blog_post_id").references(() => blogPosts.id).notNull(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
});

// Blog Settings (singleton table)
export const blogSettings = pgTable("blog_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  postsPerDay: integer("posts_per_day").default(1).notNull(),
  lastRunAt: timestamp("last_run_at"),
  seoKeywords: text("seo_keywords").default(""),
  promptStyle: text("prompt_style").default(""),
  enableTrendAnalysis: boolean("enable_trend_analysis").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  serviceIds: z.array(z.number()).optional(),
  publishedAt: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
});

export const insertBlogSettingsSchema = createInsertSchema(blogSettings).omit({
  id: true,
  updatedAt: true,
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type BlogPostService = typeof blogPostServices.$inferSelect;
export type BlogSettings = typeof blogSettings.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type InsertBlogSettings = z.infer<typeof insertBlogSettingsSchema>;

// Blog Generation Jobs - tracks autopost generation with proper scheduling, history
export const blogGenerationJobs = pgTable("blog_generation_jobs", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => blogPosts.id).notNull(),
  status: text("status").notNull().default('pending'),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  publishedPostId: integer("published_post_id").references(() => blogPosts.id),
  attempts: integer("attempts").default(1),
  lockedAt: timestamp("locked_at"),
  lockedBy: text("locked_by"),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogGenerationJobSchema = createInsertSchema(blogGenerationJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  publishedPostId: z.number().optional(),
  scheduledAt: z.union([z.date(), z.string(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    return null;
  }).nullable(),
  config: z.record(z.any()).optional(),
});

export type BlogGenerationJob = typeof blogGenerationJobs.$inferSelect;
export type InsertBlogGenerationJob = z.infer<typeof insertBlogGenerationJobSchema>;

// Time Slot Locks - prevents double-booking during concurrent requests
export const timeSlotLocks = pgTable("time_slot_locks", {
  id: serial("id").primaryKey(),
  bookingDate: date("booking_date").notNull(),
  startTime: text("start_time").notNull(), // HH:MM
  conversationId: uuid("conversation_id").notNull(),
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertTimeSlotLockSchema = createInsertSchema(timeSlotLocks).omit({
  id: true,
  lockedAt: true,
});

export type TimeSlotLock = typeof timeSlotLocks.$inferSelect;
export type InsertTimeSlotLock = z.infer<typeof insertTimeSlotLockSchema>;

// === STAFF MEMBERS ===

// Staff members who perform services (barber-shop model)
export const staffMembers = pgTable("staff_members", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  profileImageUrl: text("profile_image_url"),
  bio: text("bio"),
  isActive: boolean("is_active").default(true).notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
});

// Junction: which services each staff member can perform
export const staffServiceAbilities = pgTable("staff_service_abilities", {
  id: serial("id").primaryKey(),
  staffMemberId: integer("staff_member_id").references(() => staffMembers.id, { onDelete: "cascade" }).notNull(),
  serviceId: integer("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
});

// Per-staff working hours by day of week
export const staffAvailability = pgTable("staff_availability", {
  id: serial("id").primaryKey(),
  staffMemberId: integer("staff_member_id").references(() => staffMembers.id, { onDelete: "cascade" }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, ..., 6=Saturday (JS Date convention)
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(),     // HH:MM
  isAvailable: boolean("is_available").default(true).notNull(),
});

// Optional Google Calendar OAuth tokens per staff member
export const staffGoogleCalendar = pgTable("staff_google_calendar", {
  id: serial("id").primaryKey(),
  staffMemberId: integer("staff_member_id").references(() => staffMembers.id, { onDelete: "cascade" }).notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  calendarId: text("calendar_id").default("primary").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  needsReconnect: boolean("needs_reconnect").default(false).notNull(),
  lastDisconnectedAt: timestamp("last_disconnected_at"),
});

// Date-specific overrides: block a date or set custom hours overriding weekly schedule
export const staffAvailabilityOverrides = pgTable("staff_availability_overrides", {
  id: serial("id").primaryKey(),
  staffMemberId: integer("staff_member_id").references(() => staffMembers.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),          // YYYY-MM-DD
  isUnavailable: boolean("is_unavailable").notNull().default(false),
  startTime: text("start_time"),         // HH:MM, nullable
  endTime: text("end_time"),             // HH:MM, nullable
  reason: text("reason"),                // optional note
}, (table) => ({
  staffDateUnique: uniqueIndex("staff_availability_overrides_staff_date_unique").on(table.staffMemberId, table.date),
}));

// Staff insert schemas
export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().optional(),
});

export const insertStaffServiceAbilitySchema = createInsertSchema(staffServiceAbilities).omit({
  id: true,
});

export const insertStaffAvailabilitySchema = createInsertSchema(staffAvailability).omit({
  id: true,
});

export const insertStaffGoogleCalendarSchema = createInsertSchema(staffGoogleCalendar).omit({
  id: true,
  connectedAt: true,
  needsReconnect: true,
  lastDisconnectedAt: true,
});

export const insertStaffAvailabilityOverrideSchema = createInsertSchema(staffAvailabilityOverrides).omit({
  id: true,
});

// Staff TypeScript types
export type StaffMember = typeof staffMembers.$inferSelect;
export type StaffServiceAbility = typeof staffServiceAbilities.$inferSelect;
export type StaffAvailability = typeof staffAvailability.$inferSelect;
export type StaffGoogleCalendar = typeof staffGoogleCalendar.$inferSelect;

export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;
export type InsertStaffServiceAbility = z.infer<typeof insertStaffServiceAbilitySchema>;
export type InsertStaffAvailability = z.infer<typeof insertStaffAvailabilitySchema>;
export type InsertStaffGoogleCalendar = z.infer<typeof insertStaffGoogleCalendarSchema>;
export type InsertStaffAvailabilityOverride = z.infer<typeof insertStaffAvailabilityOverrideSchema>;

export type StaffAvailabilityOverride = typeof staffAvailabilityOverrides.$inferSelect;

// === NOTIFICATION LOGS ===

export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  channel: text("channel").notNull(),            // 'sms' | 'telegram' | 'ghl'
  trigger: text("trigger").notNull(),             // 'new_chat' | 'new_booking' | 'calendar_disconnect' | 'client_cancel' | 'client_reschedule'
  recipient: text("recipient").notNull(),         // phone number or Telegram chat ID
  preview: text("preview").notNull(),             // message body, truncated to 5000 chars before insert
  status: text("status").notNull(),               // 'sent' | 'failed' | 'skipped'
  errorMessage: text("error_message"),
  providerMessageId: text("provider_message_id"), // Twilio SID, Telegram message_id, GHL contactId
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({
  id: true,
  sentAt: true,
});

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
