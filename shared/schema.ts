import { pgTable, text, serial, integer, numeric, timestamp, boolean, date, jsonb, uuid } from "drizzle-orm/pg-core";
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
  profileImageUrl: text("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
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
});

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
});

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
  heroBadgeImageUrl?: string;
  heroBadgeAlt?: string;
  trustBadges?: { title: string; description: string; icon?: string }[];
  categoriesSection?: { title?: string; subtitle?: string; ctaText?: string };
  reviewsSection?: { title?: string; subtitle?: string; embedUrl?: string };
  blogSection?: { title?: string; subtitle?: string; viewAllText?: string; readMoreText?: string };
  areasServedSection?: { label?: string; heading?: string; description?: string; ctaText?: string };
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
