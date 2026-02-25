import { db } from "./db";
import {
  users,
  type User,
  type UpsertUser,
  categories,
  subcategories,
  services,
  serviceAddons,
  serviceOptions,
  serviceFrequencies,
  bookings,
  bookingItems,
  chatSettings,
  chatIntegrations,
  twilioSettings,
  telegramSettings,
  conversations,
  conversationMessages,
  companySettings,
  faqs,
  serviceAreas,
  serviceAreaGroups,
  serviceAreaCities,
  integrationSettings,
  blogPosts,
  blogSettings,
  blogPostServices,
  timeSlotLocks,
  type Category,
  type Subcategory,
  type Service,
  type ServiceAddon,
  type ServiceOption,
  type ServiceFrequency,
  type Booking,
  type BookingItem,
  type CompanySettings,
  type ChatSettings,
  type ChatIntegrations,
  type TwilioSettings,
  type TelegramSettings,
  type Conversation,
  type ConversationMessage,
  type Faq,
  type ServiceArea,
  type ServiceAreaGroup,
  type ServiceAreaCity,
  type IntegrationSettings,
  type BlogPost,
  type BlogSettings,
  type BlogPostService,
  type InsertCategory,
  type InsertService,
  type InsertServiceAddon,
  type InsertServiceOption,
  type InsertServiceFrequency,
  type InsertBooking,
  type InsertChatSettings,
  type InsertChatIntegrations,
  type InsertTwilioSettings,
  type InsertTelegramSettings,
  type InsertConversation,
  type InsertConversationMessage,
  type InsertFaq,
  type InsertServiceArea,
  type InsertServiceAreaGroup,
  type InsertServiceAreaCity,
  type InsertIntegrationSettings,
  type InsertBlogPost,
  type InsertBlogSettings,
  type TimeSlotLock,
  type InsertTimeSlotLock,
  type BookingItemOption,
  type BookingItemFrequency,
  type PriceBreakdown,
  type InsertCompanySettings,
  type BusinessHours,
  DEFAULT_BUSINESS_HOURS,
} from "@shared/schema";
import { eq, and, or, gte, lte, inArray, desc, asc, sql, ne } from "drizzle-orm";
import { z } from "zod";

export const insertSubcategorySchema = z.object({
  categoryId: z.number(),
  name: z.string().min(1),
  slug: z.string().min(1),
});
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Categories & Services
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getServices(categoryId?: number, subcategoryId?: number, includeHidden?: boolean, showOnLanding?: boolean): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;

  // Subcategories
  getSubcategories(categoryId?: number): Promise<Subcategory[]>;
  createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: number, subcategory: Partial<InsertSubcategory>): Promise<Subcategory>;
  deleteSubcategory(id: number): Promise<void>;

  // Service Addons
  getServiceAddons(serviceId: number): Promise<Service[]>;
  setServiceAddons(serviceId: number, addonServiceIds: number[]): Promise<void>;
  getAddonRelationships(): Promise<ServiceAddon[]>;

  // Service Options (for base_plus_addons pricing)
  getServiceOptions(serviceId: number): Promise<ServiceOption[]>;
  createServiceOption(option: InsertServiceOption): Promise<ServiceOption>;
  updateServiceOption(id: number, option: Partial<InsertServiceOption>): Promise<ServiceOption>;
  deleteServiceOption(id: number): Promise<void>;
  setServiceOptions(serviceId: number, options: Omit<InsertServiceOption, 'serviceId'>[]): Promise<ServiceOption[]>;

  // Service Frequencies (for base_plus_addons pricing)
  getServiceFrequencies(serviceId: number): Promise<ServiceFrequency[]>;
  createServiceFrequency(frequency: InsertServiceFrequency): Promise<ServiceFrequency>;
  updateServiceFrequency(id: number, frequency: Partial<InsertServiceFrequency>): Promise<ServiceFrequency>;
  deleteServiceFrequency(id: number): Promise<void>;
  setServiceFrequencies(serviceId: number, frequencies: Omit<InsertServiceFrequency, 'serviceId'>[]): Promise<ServiceFrequency[]>;

  // Bookings
  createBooking(booking: InsertBooking & { totalPrice: string, totalDurationMinutes: number, endTime: string, bookingItemsData?: any[] }): Promise<Booking>;
  getBookings(limit?: number): Promise<Booking[]>;
  getBookingsByDate(date: string): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  updateBooking(
    id: number,
    updates: Partial<{
      customerName: string;
      customerEmail: string | null;
      customerPhone: string;
      customerAddress: string;
      bookingDate: string;
      startTime: string;
      endTime: string;
      status: string;
      paymentStatus: string;
      totalPrice: string;
    }> & {
      bookingItems?: Array<{
        serviceId: number;
        serviceName: string;
        price: string;
        quantity?: number;
      }>;
    }
  ): Promise<Booking>;
  deleteBooking(id: number): Promise<void>;
  getBookingItems(bookingId: number): Promise<BookingItem[]>;

  // Category CRUD
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Service CRUD
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  reorderServices(order: { id: number; order: number }[]): Promise<void>;

  // Company Settings
  getCompanySettings(): Promise<CompanySettings>;
  updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings>;
  getBusinessHours(): Promise<BusinessHours>;

  // FAQs
  getFaqs(includeInactive?: boolean): Promise<Faq[]>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq>;
  deleteFaq(id: number): Promise<void>;

  // Service Areas (legacy - kept for backward compatibility)
  getServiceAreas(includeInactive?: boolean): Promise<ServiceArea[]>;
  createServiceArea(area: InsertServiceArea): Promise<ServiceArea>;
  updateServiceArea(id: number, area: Partial<InsertServiceArea>): Promise<ServiceArea>;
  deleteServiceArea(id: number): Promise<void>;
  reorderServiceAreas(updates: { id: number; order: number }[]): Promise<void>;

  // Service Area Groups (hierarchical - regions/counties)
  getServiceAreaGroups(includeInactive?: boolean): Promise<ServiceAreaGroup[]>;
  createServiceAreaGroup(group: InsertServiceAreaGroup): Promise<ServiceAreaGroup>;
  updateServiceAreaGroup(id: number, group: Partial<InsertServiceAreaGroup>): Promise<ServiceAreaGroup>;
  deleteServiceAreaGroup(id: number): Promise<void>;
  reorderServiceAreaGroups(updates: { id: number; order: number }[]): Promise<void>;

  // Service Area Cities (hierarchical - cities within groups)
  getServiceAreaCities(groupId?: number, includeInactive?: boolean): Promise<ServiceAreaCity[]>;
  createServiceAreaCity(city: InsertServiceAreaCity): Promise<ServiceAreaCity>;
  updateServiceAreaCity(id: number, city: Partial<InsertServiceAreaCity>): Promise<ServiceAreaCity>;
  deleteServiceAreaCity(id: number): Promise<void>;
  reorderServiceAreaCities(updates: { id: number; order: number }[]): Promise<void>;

  // Integration Settings
  getIntegrationSettings(provider: string): Promise<IntegrationSettings | undefined>;
  upsertIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings>;

  // Booking GHL sync
  updateBookingGHLSync(bookingId: number, ghlContactId: string, ghlAppointmentId: string, syncStatus: string): Promise<void>;

  // Chat
  getChatSettings(): Promise<ChatSettings>;
  updateChatSettings(settings: Partial<InsertChatSettings>): Promise<ChatSettings>;
  getChatIntegration(provider: string): Promise<ChatIntegrations | undefined>;
  upsertChatIntegration(settings: InsertChatIntegrations): Promise<ChatIntegrations>;
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;

  // Twilio Integration
  getTwilioSettings(): Promise<TwilioSettings | undefined>;
  saveTwilioSettings(settings: InsertTwilioSettings): Promise<TwilioSettings>;
  getTelegramSettings(): Promise<TelegramSettings | undefined>;
  saveTelegramSettings(settings: InsertTelegramSettings): Promise<TelegramSettings>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<void>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  findOpenConversationByContact(phone?: string, email?: string, excludeId?: string): Promise<Conversation | undefined>;

  // Blog Posts
  getBlogPosts(status?: string): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getPublishedBlogPosts(limit?: number, offset?: number): Promise<BlogPost[]>;
  getRelatedBlogPosts(postId: number, limit?: number): Promise<BlogPost[]>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;
  getBlogPostServices(postId: number): Promise<Service[]>;
  setBlogPostServices(postId: number, serviceIds: number[]): Promise<void>;
  countPublishedBlogPosts(): Promise<number>;
  getBlogSettings(): Promise<BlogSettings | undefined>;
  upsertBlogSettings(settings: InsertBlogSettings): Promise<BlogSettings>;

  // Time Slot Locks
  acquireTimeSlotLock(bookingDate: string, startTime: string, conversationId: string, ttlMs?: number): Promise<boolean>;
  releaseTimeSlotLock(bookingDate: string, startTime: string, conversationId: string): Promise<void>;
  cleanExpiredTimeSlotLocks(): Promise<number>;

  // GHL Sync Queue
  getBookingsPendingSync(): Promise<Booking[]>;
  updateBookingSyncStatus(bookingId: number, status: string, ghlContactId?: string, ghlAppointmentId?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async createUser(user: UpsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  async updateUser(id: string, user: Partial<UpsertUser>): Promise<User> {
    const [updated] = await db.update(users).set({ ...user, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updated;
  }
  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  private chatSchemaEnsured = false;
  private companySchemaEnsured = false;
  private conversationSchemaEnsured = false;

  private async ensureChatSchema(): Promise<void> {
    if (this.chatSchemaEnsured) return;
    try {
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "agent_avatar_url" text DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "avg_response_time" text DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "language_selector_enabled" boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "default_language" text DEFAULT 'en'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "system_prompt" text DEFAULT 'You are our helpful chat assistant. Provide concise, friendly answers. Use the provided tools to fetch services, details, and availability. Do not guess prices or availability; always use tool data when relevant. If booking is requested, gather details and direct the user to the booking page at /booking.'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "intake_objectives" jsonb DEFAULT '[]'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "avg_response_time" text DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_provider" text DEFAULT 'gohighlevel'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_id" text DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_staff" jsonb DEFAULT '[]'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "use_knowledge_base" boolean DEFAULT true`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "use_faqs" boolean DEFAULT true`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "active_provider" text DEFAULT 'openai'`);
      this.chatSchemaEnsured = true;
    } catch (err) {
      console.error("ensureChatSchema error:", err);
      this.chatSchemaEnsured = false;
    }
  }

  private async ensureCompanySchema(): Promise<void> {
    if (this.companySchemaEnsured) return;
    try {
      await db.execute(sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "time_zone" text DEFAULT 'America/New_York'`);
      // Use raw string for default value to avoid parameter binding issues in ALTER TABLE
      await db.execute(sql.raw(`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "business_hours" jsonb DEFAULT '${JSON.stringify(DEFAULT_BUSINESS_HOURS)}'`));
      this.companySchemaEnsured = true;
    } catch (err) {
      console.error("ensureCompanySchema error:", err);
      this.companySchemaEnsured = false;
    }
  }

  private async ensureConversationSchema(): Promise<void> {
    if (this.conversationSchemaEnsured) return;
    try {
      await db.execute(sql`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "memory" jsonb DEFAULT '{}'`);
      await db.execute(sql`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "visitor_address" text`);
      await db.execute(sql`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "visitor_zipcode" text`);
      await db.execute(sql`ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "last_message" text`);
      // Backfill last_message from most recent message for any conversation missing it
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
      this.conversationSchemaEnsured = true;
    } catch (err) {
      console.error("ensureConversationSchema error:", err);
      this.conversationSchemaEnsured = false;
    }
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.order);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async getServices(categoryId?: number, subcategoryId?: number, includeHidden: boolean = false, showOnLanding?: boolean): Promise<Service[]> {
    const baseConditions = [eq(services.isArchived, false)];
    if (!includeHidden) {
      baseConditions.push(eq(services.isHidden, false));
    }
    if (showOnLanding !== undefined) {
      baseConditions.push(eq(services.showOnLanding, showOnLanding));
    }

    if (subcategoryId) {
      return await db
        .select()
        .from(services)
        .where(and(...baseConditions, eq(services.subcategoryId, subcategoryId)))
        .orderBy(asc(services.order), asc(services.id));
    }
    if (categoryId) {
      return await db
        .select()
        .from(services)
        .where(and(...baseConditions, eq(services.categoryId, categoryId)))
        .orderBy(asc(services.order), asc(services.id));
    }
    return await db
      .select()
      .from(services)
      .where(and(...baseConditions))
      .orderBy(asc(services.order), asc(services.id));
  }

  async getSubcategories(categoryId?: number): Promise<Subcategory[]> {
    if (categoryId) {
      return await db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId));
    }
    return await db.select().from(subcategories);
  }

  async createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory> {
    const [newSubcategory] = await db.insert(subcategories).values(subcategory).returning();
    return newSubcategory;
  }

  async updateSubcategory(id: number, subcategory: Partial<InsertSubcategory>): Promise<Subcategory> {
    const [updated] = await db.update(subcategories).set(subcategory).where(eq(subcategories.id, id)).returning();
    return updated;
  }

  async deleteSubcategory(id: number): Promise<void> {
    await db.delete(subcategories).where(eq(subcategories.id, id));
  }

  async getServiceAddons(serviceId: number): Promise<Service[]> {
    const addonRelations = await db.select().from(serviceAddons).where(eq(serviceAddons.serviceId, serviceId));
    if (addonRelations.length === 0) return [];

    const addonIds = addonRelations.map(r => r.addonServiceId);
    return await db
      .select()
      .from(services)
      .where(and(inArray(services.id, addonIds), eq(services.isArchived, false)));
  }

  async setServiceAddons(serviceId: number, addonServiceIds: number[]): Promise<void> {
    await db.delete(serviceAddons).where(eq(serviceAddons.serviceId, serviceId));

    if (addonServiceIds.length > 0) {
      const values = addonServiceIds.map(addonId => ({
        serviceId,
        addonServiceId: addonId
      }));
      await db.insert(serviceAddons).values(values);
    }
  }

  async getAddonRelationships(): Promise<ServiceAddon[]> {
    return await db.select().from(serviceAddons);
  }

  // Service Options (for base_plus_addons pricing)
  async getServiceOptions(serviceId: number): Promise<ServiceOption[]> {
    return await db
      .select()
      .from(serviceOptions)
      .where(eq(serviceOptions.serviceId, serviceId))
      .orderBy(asc(serviceOptions.order), asc(serviceOptions.id));
  }

  async createServiceOption(option: InsertServiceOption): Promise<ServiceOption> {
    const [newOption] = await db.insert(serviceOptions).values(option).returning();
    return newOption;
  }

  async updateServiceOption(id: number, option: Partial<InsertServiceOption>): Promise<ServiceOption> {
    const [updated] = await db.update(serviceOptions).set(option).where(eq(serviceOptions.id, id)).returning();
    return updated;
  }

  async deleteServiceOption(id: number): Promise<void> {
    await db.delete(serviceOptions).where(eq(serviceOptions.id, id));
  }

  async setServiceOptions(serviceId: number, options: Omit<InsertServiceOption, 'serviceId'>[]): Promise<ServiceOption[]> {
    // Delete existing options
    await db.delete(serviceOptions).where(eq(serviceOptions.serviceId, serviceId));

    if (options.length === 0) return [];

    // Insert new options
    const values = options.map((opt, index) => ({
      ...opt,
      serviceId,
      order: opt.order ?? index,
    }));
    return await db.insert(serviceOptions).values(values).returning();
  }

  // Service Frequencies (for base_plus_addons pricing)
  async getServiceFrequencies(serviceId: number): Promise<ServiceFrequency[]> {
    return await db
      .select()
      .from(serviceFrequencies)
      .where(eq(serviceFrequencies.serviceId, serviceId))
      .orderBy(asc(serviceFrequencies.order), asc(serviceFrequencies.id));
  }

  async createServiceFrequency(frequency: InsertServiceFrequency): Promise<ServiceFrequency> {
    const [newFrequency] = await db.insert(serviceFrequencies).values(frequency).returning();
    return newFrequency;
  }

  async updateServiceFrequency(id: number, frequency: Partial<InsertServiceFrequency>): Promise<ServiceFrequency> {
    const [updated] = await db.update(serviceFrequencies).set(frequency).where(eq(serviceFrequencies.id, id)).returning();
    return updated;
  }

  async deleteServiceFrequency(id: number): Promise<void> {
    await db.delete(serviceFrequencies).where(eq(serviceFrequencies.id, id));
  }

  async setServiceFrequencies(serviceId: number, frequencies: Omit<InsertServiceFrequency, 'serviceId'>[]): Promise<ServiceFrequency[]> {
    // Delete existing frequencies
    await db.delete(serviceFrequencies).where(eq(serviceFrequencies.serviceId, serviceId));

    if (frequencies.length === 0) return [];

    // Insert new frequencies
    const values = frequencies.map((freq, index) => ({
      ...freq,
      serviceId,
      order: freq.order ?? index,
    }));
    return await db.insert(serviceFrequencies).values(values).returning();
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db
      .select()
      .from(services)
      .where(and(eq(services.id, id), eq(services.isArchived, false)));
    return service;
  }

  async createBooking(booking: InsertBooking & { totalPrice: string, totalDurationMinutes: number, endTime: string, bookingItemsData?: any[] }): Promise<Booking> {
    // Use transaction to ensure booking and items are created atomically
    return await db.transaction(async (tx) => {
      // 1. Create Booking
      const [newBooking] = await tx.insert(bookings).values({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        customerAddress: booking.customerAddress,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalDurationMinutes: booking.totalDurationMinutes,
        totalPrice: booking.totalPrice,
        paymentMethod: booking.paymentMethod,
        status: 'pending',
      }).returning();

      // 2. Create Booking Items
      // Support both legacy format (serviceIds) and new format (cartItems/bookingItemsData)
      if (booking.bookingItemsData && booking.bookingItemsData.length > 0) {
        // New format with detailed pricing info
        for (const item of booking.bookingItemsData) {
          await tx.insert(bookingItems).values({
            bookingId: newBooking.id,
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            price: item.price,
            quantity: item.quantity || 1,
            pricingType: item.pricingType || 'fixed_item',
            areaSize: item.areaSize,
            areaValue: item.areaValue,
            selectedOptions: item.selectedOptions,
            selectedFrequency: item.selectedFrequency,
            customerNotes: item.customerNotes,
            priceBreakdown: item.priceBreakdown,
          });
        }
      } else if (booking.serviceIds && booking.serviceIds.length > 0) {
        // Legacy format - simple service IDs
        for (const serviceId of booking.serviceIds) {
          const service = await this.getService(serviceId);
          if (service) {
            await tx.insert(bookingItems).values({
              bookingId: newBooking.id,
              serviceId: service.id,
              serviceName: service.name,
              price: service.price,
              quantity: 1,
              pricingType: service.pricingType || 'fixed_item',
            });
          }
        }
      }

      return newBooking;
    });
  }

  async getBookings(limit: number = 50): Promise<Booking[]> {
    return await db.select().from(bookings).orderBy(desc(bookings.bookingDate)).limit(limit);
  }

  async getBookingsByDate(date: string): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.bookingDate, date));
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async updateBooking(
    id: number,
    updates: Partial<{
      customerName: string;
      customerEmail: string | null;
      customerPhone: string;
      customerAddress: string;
      bookingDate: string;
      startTime: string;
      endTime: string;
      status: string;
      paymentStatus: string;
      totalPrice: string;
    }> & {
      bookingItems?: Array<{
        serviceId: number;
        serviceName: string;
        price: string;
        quantity?: number;
      }>;
    }
  ): Promise<Booking> {
    return await db.transaction(async (tx) => {
      const { bookingItems: items, ...bookingUpdates } = updates;
      let updated: Booking | undefined;

      if (Object.keys(bookingUpdates).length > 0) {
        [updated] = await tx.update(bookings).set(bookingUpdates).where(eq(bookings.id, id)).returning();
      }

      if (items) {
        await tx.delete(bookingItems).where(eq(bookingItems.bookingId, id));
        for (const item of items) {
          await tx.insert(bookingItems).values({
            bookingId: id,
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            price: item.price,
            quantity: item.quantity ?? 1,
            pricingType: 'fixed_item',
          });
        }
      }

      if (!updated) {
        const [existing] = await tx.select().from(bookings).where(eq(bookings.id, id));
        return existing;
      }

      return updated;
    });
  }

  async deleteBooking(id: number): Promise<void> {
    // First delete booking items
    await db.delete(bookingItems).where(eq(bookingItems.bookingId, id));
    // Then delete the booking
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking> {
    const [updated] = await db.update(bookings).set({ status }).where(eq(bookings.id, id)).returning();
    return updated;
  }

  async getBookingItems(bookingId: number): Promise<BookingItem[]> {
    return await db.select().from(bookingItems).where(eq(bookingItems.bookingId, bookingId));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return updated;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async createService(service: InsertService): Promise<Service> {
    let nextOrder = service.order;
    if (nextOrder === undefined || nextOrder === null) {
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${services.order}), 0)` })
        .from(services);
      nextOrder = Number(maxOrder ?? 0) + 1;
    }
    const [newService] = await db.insert(services).values({ ...service, order: nextOrder }).returning();
    return newService;
  }

  async updateService(id: number, service: Partial<InsertService>): Promise<Service> {
    const [updated] = await db.update(services).set(service).where(eq(services.id, id)).returning();
    return updated;
  }

  async deleteService(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(serviceAddons).where(eq(serviceAddons.serviceId, id));
      await tx.delete(serviceAddons).where(eq(serviceAddons.addonServiceId, id));
      await tx.delete(serviceOptions).where(eq(serviceOptions.serviceId, id));
      await tx.delete(serviceFrequencies).where(eq(serviceFrequencies.serviceId, id));
      await tx.delete(blogPostServices).where(eq(blogPostServices.serviceId, id));
      await tx.update(services).set({ isArchived: true }).where(eq(services.id, id));
    });
  }

  async reorderServices(order: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const item of order) {
        await tx.update(services).set({ order: item.order }).where(eq(services.id, item.id));
      }
    });
  }

  async getCompanySettings(): Promise<CompanySettings> {
    try {
      await this.ensureCompanySchema();
      const [settings] = await db.select().from(companySettings);
      if (settings) return settings;
    } catch (err) {
      console.error("getCompanySettings initial read failed, retrying after ensuring schema:", err);
      this.companySchemaEnsured = false;
      await this.ensureCompanySchema();
    }

    // Create default settings if none exist
    const [newSettings] = await db.insert(companySettings).values({}).returning();
    return newSettings;
  }

  async updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    try {
      await this.ensureCompanySchema();
      const existing = await this.getCompanySettings();
      const [updated] = await db.update(companySettings).set(settings).where(eq(companySettings.id, existing.id)).returning();
      return updated;
    } catch (err) {
      console.error("updateCompanySettings failed, retrying after ensuring schema:", err);
      this.companySchemaEnsured = false;
      await this.ensureCompanySchema();
      const existing = await this.getCompanySettings();
      const [updated] = await db.update(companySettings).set(settings).where(eq(companySettings.id, existing.id)).returning();
      return updated;
    }
  }

  async getBusinessHours(): Promise<BusinessHours> {
    const settings = await this.getCompanySettings();
    if (settings?.businessHours) {
      return settings.businessHours as BusinessHours;
    }
    return DEFAULT_BUSINESS_HOURS;
  }

  async getFaqs(includeInactive: boolean = false): Promise<Faq[]> {
    if (includeInactive) {
      return await db.select().from(faqs).orderBy(faqs.order);
    }
    return await db.select().from(faqs).where(eq(faqs.isActive, true)).orderBy(faqs.order);
  }

  async createFaq(faq: InsertFaq): Promise<Faq> {
    const [newFaq] = await db.insert(faqs).values(faq).returning();
    return newFaq;
  }

  async updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq> {
    const [updated] = await db.update(faqs).set(faq).where(eq(faqs.id, id)).returning();
    return updated;
  }

  async deleteFaq(id: number): Promise<void> {
    await db.delete(faqs).where(eq(faqs.id, id));
  }

  async getServiceAreas(includeInactive: boolean = false): Promise<ServiceArea[]> {
    if (includeInactive) {
      return await db.select().from(serviceAreas).orderBy(serviceAreas.order);
    }
    return await db.select().from(serviceAreas).where(eq(serviceAreas.isActive, true)).orderBy(serviceAreas.order);
  }

  async createServiceArea(area: InsertServiceArea): Promise<ServiceArea> {
    const [newArea] = await db.insert(serviceAreas).values(area).returning();
    return newArea;
  }

  async updateServiceArea(id: number, area: Partial<InsertServiceArea>): Promise<ServiceArea> {
    const [updated] = await db.update(serviceAreas).set(area).where(eq(serviceAreas.id, id)).returning();
    if (!updated) throw new Error('Service area not found');
    return updated;
  }

  async deleteServiceArea(id: number): Promise<void> {
    await db.delete(serviceAreas).where(eq(serviceAreas.id, id));
  }

  async reorderServiceAreas(updates: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(serviceAreas)
          .set({ order: update.order })
          .where(eq(serviceAreas.id, update.id));
      }
    });
  }

  // === Service Area Groups (Hierarchical) ===
  async getServiceAreaGroups(includeInactive: boolean = false): Promise<ServiceAreaGroup[]> {
    if (includeInactive) {
      return await db.select().from(serviceAreaGroups).orderBy(serviceAreaGroups.order);
    }
    return await db.select().from(serviceAreaGroups).where(eq(serviceAreaGroups.isActive, true)).orderBy(serviceAreaGroups.order);
  }

  async createServiceAreaGroup(group: InsertServiceAreaGroup): Promise<ServiceAreaGroup> {
    const [newGroup] = await db.insert(serviceAreaGroups).values(group).returning();
    return newGroup;
  }

  // Blog Settings
  async getBlogSettings(): Promise<BlogSettings | undefined> {
    const [settings] = await db.select().from(blogSettings);
    return settings;
  }

  async upsertBlogSettings(settings: InsertBlogSettings): Promise<BlogSettings> {
    const existing = await this.getBlogSettings();
    if (existing) {
      const [updated] = await db.update(blogSettings).set({ ...settings, updatedAt: new Date() }).where(eq(blogSettings.id, existing.id)).returning();
      return updated;
    } else {
      const [created] = await db.insert(blogSettings).values(settings).returning();
      return created;
    }
  }

  async updateServiceAreaGroup(id: number, group: Partial<InsertServiceAreaGroup>): Promise<ServiceAreaGroup> {
    const [updated] = await db.update(serviceAreaGroups).set(group).where(eq(serviceAreaGroups.id, id)).returning();
    if (!updated) throw new Error('Service area group not found');
    return updated;
  }

  async deleteServiceAreaGroup(id: number): Promise<void> {
    // Check if group has cities
    const cities = await db.select().from(serviceAreaCities).where(eq(serviceAreaCities.areaGroupId, id));
    if (cities.length > 0) {
      throw new Error(`Cannot delete area group with ${cities.length} cities. Delete or reassign cities first.`);
    }
    await db.delete(serviceAreaGroups).where(eq(serviceAreaGroups.id, id));
  }

  async reorderServiceAreaGroups(updates: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(serviceAreaGroups)
          .set({ order: update.order })
          .where(eq(serviceAreaGroups.id, update.id));
      }
    });
  }

  // === Service Area Cities (Hierarchical) ===
  async getServiceAreaCities(groupId?: number, includeInactive: boolean = false): Promise<ServiceAreaCity[]> {
    let query = db.select().from(serviceAreaCities);

    const conditions = [];
    if (groupId) {
      conditions.push(eq(serviceAreaCities.areaGroupId, groupId));
    }
    if (!includeInactive) {
      conditions.push(eq(serviceAreaCities.isActive, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(serviceAreaCities.order);
  }

  async createServiceAreaCity(city: InsertServiceAreaCity): Promise<ServiceAreaCity> {
    const [newCity] = await db.insert(serviceAreaCities).values(city).returning();
    return newCity;
  }

  async updateServiceAreaCity(id: number, city: Partial<InsertServiceAreaCity>): Promise<ServiceAreaCity> {
    const [updated] = await db.update(serviceAreaCities).set(city).where(eq(serviceAreaCities.id, id)).returning();
    if (!updated) throw new Error('Service area city not found');
    return updated;
  }

  async deleteServiceAreaCity(id: number): Promise<void> {
    await db.delete(serviceAreaCities).where(eq(serviceAreaCities.id, id));
  }

  async reorderServiceAreaCities(updates: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(serviceAreaCities)
          .set({ order: update.order })
          .where(eq(serviceAreaCities.id, update.id));
      }
    });
  }

  async getIntegrationSettings(provider: string): Promise<IntegrationSettings | undefined> {
    const [settings] = await db.select().from(integrationSettings).where(eq(integrationSettings.provider, provider));
    return settings;
  }

  async upsertIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings> {
    const provider = settings.provider || "gohighlevel";
    console.log(`Storage: upsertIntegrationSettings for provider: ${provider}`);
    const existing = await this.getIntegrationSettings(provider);
    console.log(`Storage: existing settings for ${provider}:`, existing ? `id=${existing.id}` : 'none');

    if (existing) {
      console.log(`Storage: updating existing settings for ${provider} with id ${existing.id}`);
      const [updated] = await db
        .update(integrationSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(integrationSettings.id, existing.id))
        .returning();
      console.log(`Storage: updated settings for ${provider}:`, { ...updated, apiKey: updated.apiKey ? 'masked' : 'none' });
      return updated;
    } else {
      console.log(`Storage: creating new settings for ${provider}`);
      const [created] = await db.insert(integrationSettings).values(settings).returning();
      console.log(`Storage: created settings for ${provider}:`, { ...created, apiKey: created.apiKey ? 'masked' : 'none' });
      return created;
    }
  }

  async updateBookingGHLSync(bookingId: number, ghlContactId: string, ghlAppointmentId: string, syncStatus: string): Promise<void> {
    await db
      .update(bookings)
      .set({ ghlContactId, ghlAppointmentId, ghlSyncStatus: syncStatus })
      .where(eq(bookings.id, bookingId));
  }

  async getChatSettings(): Promise<ChatSettings> {
    try {
      await this.ensureChatSchema();
      const [settings] = await db.select().from(chatSettings);
      if (settings) return settings;
    } catch (err) {
      console.error("getChatSettings initial read failed, retrying after ensuring schema:", err);
      this.chatSchemaEnsured = false;
      await this.ensureChatSchema();
    }

    const [created] = await db.insert(chatSettings).values({}).returning();
    return created;
  }

  async updateChatSettings(settings: Partial<InsertChatSettings>): Promise<ChatSettings> {
    try {
      await this.ensureChatSchema();
      const existing = await this.getChatSettings();
      const [updated] = await db
        .update(chatSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(chatSettings.id, existing.id))
        .returning();
      return updated;
    } catch (err) {
      console.error("updateChatSettings failed, retrying after ensuring schema:", err);
      this.chatSchemaEnsured = false;
      await this.ensureChatSchema();
      const existing = await this.getChatSettings();
      const [updated] = await db
        .update(chatSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(chatSettings.id, existing.id))
        .returning();
      return updated;
    }
  }

  async getChatIntegration(provider: string): Promise<ChatIntegrations | undefined> {
    const normalizedProvider = (provider || "openai").trim().toLowerCase();
    const [integration] = await db
      .select()
      .from(chatIntegrations)
      .where(eq(chatIntegrations.provider, normalizedProvider))
      .orderBy(desc(chatIntegrations.updatedAt), desc(chatIntegrations.id))
      .limit(1);
    return integration;
  }

  async upsertChatIntegration(settings: InsertChatIntegrations): Promise<ChatIntegrations> {
    const provider = (settings.provider || "openai").trim().toLowerCase();
    const existing = await this.getChatIntegration(provider);
    if (existing) {
      const payload = {
        ...settings,
        provider,
        apiKey: settings.apiKey ?? existing.apiKey,
        updatedAt: new Date(),
      };

      // Update by provider to keep legacy duplicate rows consistent.
      await db
        .update(chatIntegrations)
        .set(payload)
        .where(eq(chatIntegrations.provider, provider));

      const updated = await this.getChatIntegration(provider);
      if (!updated) {
        throw new Error(`Failed to update chat integration for provider ${provider}`);
      }
      return updated;
    }

    const [created] = await db
      .insert(chatIntegrations)
      .values({ ...settings, provider })
      .returning();
    return created;
  }

  async getTwilioSettings(): Promise<TwilioSettings | undefined> {
    const [settings] = await db.select().from(twilioSettings).limit(1);
    return settings;
  }

  async saveTwilioSettings(settings: InsertTwilioSettings): Promise<TwilioSettings> {
    const existing = await this.getTwilioSettings();
    if (existing) {
      const payload = {
        ...settings,
        authToken: settings.authToken ?? existing.authToken,
        updatedAt: new Date(),
      };
      const [updated] = await db
        .update(twilioSettings)
        .set(payload)
        .where(eq(twilioSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(twilioSettings).values(settings).returning();
    return created;
  }

  async getTelegramSettings(): Promise<TelegramSettings | undefined> {
    const [settings] = await db.select().from(telegramSettings).limit(1);
    return settings;
  }

  async saveTelegramSettings(settings: InsertTelegramSettings): Promise<TelegramSettings> {
    const existing = await this.getTelegramSettings();
    if (existing) {
      const payload = {
        ...settings,
        botToken: settings.botToken ?? existing.botToken,
        updatedAt: new Date(),
      };
      const [updated] = await db
        .update(telegramSettings)
        .set(payload)
        .where(eq(telegramSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(telegramSettings).values(settings).returning();
    return created;
  }

  async getConversations(): Promise<Conversation[]> {
    await this.ensureConversationSchema();
    const convs = await db
      .select()
      .from(conversations)
      .orderBy(desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`));

    // Fill in lastMessage from latest conversation_messages for any conversation missing it
    for (const conv of convs) {
      if (!conv.lastMessage) {
        const [latestMsg] = await db
          .select({ content: conversationMessages.content })
          .from(conversationMessages)
          .where(eq(conversationMessages.conversationId, conv.id))
          .orderBy(desc(conversationMessages.createdAt))
          .limit(1);
        if (latestMsg) {
          conv.lastMessage = latestMsg.content;
        }
      }
    }

    return convs;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    await this.ensureConversationSchema();
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    await this.ensureConversationSchema();
    const [updated] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async deleteConversation(id: string): Promise<void> {
    await db.delete(conversationMessages).where(eq(conversationMessages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    await this.ensureConversationSchema();
    const [created] = await db.insert(conversations).values(conversation).returning();
    return created;
  }

  async addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const [created] = await db.insert(conversationMessages).values(message).returning();

    // Update parent conversation's lastMessage and lastMessageAt
    await this.updateConversation(message.conversationId, {
      lastMessage: message.content,
      lastMessageAt: new Date(),
    });

    return created;
  }

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(asc(conversationMessages.createdAt));
  }

  async findOpenConversationByContact(phone?: string, email?: string, excludeId?: string): Promise<Conversation | undefined> {
    if (!phone && !email) return undefined;

    const conditions: any[] = [eq(conversations.status, 'open')];

    const contactConditions: any[] = [];
    if (phone) contactConditions.push(eq(conversations.visitorPhone, phone));
    if (email) contactConditions.push(eq(conversations.visitorEmail, email));
    conditions.push(or(...contactConditions));

    if (excludeId) {
      conditions.push(ne(conversations.id, excludeId));
    }

    const [existing] = await db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`))
      .limit(1);

    return existing;
  }

  async getBlogPosts(status?: string): Promise<BlogPost[]> {
    if (status) {
      return await db.select().from(blogPosts).where(eq(blogPosts.status, status)).orderBy(desc(blogPosts.createdAt));
    }
    return await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async getPublishedBlogPosts(limit: number = 10, offset: number = 0): Promise<BlogPost[]> {
    return await db.select()
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  async getRelatedBlogPosts(postId: number, limit: number = 4): Promise<BlogPost[]> {
    return await db.select()
      .from(blogPosts)
      .where(and(
        eq(blogPosts.status, 'published'),
        ne(blogPosts.id, postId)
      ))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit);
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const { serviceIds, ...postData } = post;
    const [newPost] = await db.insert(blogPosts).values(postData).returning();

    if (serviceIds && serviceIds.length > 0) {
      await this.setBlogPostServices(newPost.id, serviceIds);
    }

    return newPost;
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost> {
    const { serviceIds, ...postData } = post;
    const [updated] = await db.update(blogPosts)
      .set({ ...postData, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();

    if (serviceIds !== undefined) {
      await this.setBlogPostServices(id, serviceIds);
    }

    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPostServices).where(eq(blogPostServices.blogPostId, id));
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async getBlogPostServices(postId: number): Promise<Service[]> {
    const relations = await db.select().from(blogPostServices).where(eq(blogPostServices.blogPostId, postId));
    if (relations.length === 0) return [];

    const serviceIds = relations.map(r => r.serviceId);
    return await db.select().from(services).where(inArray(services.id, serviceIds));
  }

  async setBlogPostServices(postId: number, serviceIds: number[]): Promise<void> {
    await db.delete(blogPostServices).where(eq(blogPostServices.blogPostId, postId));

    if (serviceIds.length > 0) {
      const values = serviceIds.map(serviceId => ({
        blogPostId: postId,
        serviceId
      }));
      await db.insert(blogPostServices).values(values);
    }
  }

  async countPublishedBlogPosts(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'));
    return Number(result[0]?.count || 0);
  }


  // Time Slot Locks - Persistent implementation
  async acquireTimeSlotLock(bookingDate: string, startTime: string, conversationId: string, ttlMs: number = 30000): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // First, clean up any expired locks for this slot
    await db.delete(timeSlotLocks).where(
      and(
        eq(timeSlotLocks.bookingDate, bookingDate),
        eq(timeSlotLocks.startTime, startTime),
        lte(timeSlotLocks.expiresAt, now)
      )
    );

    // Check if there's an active lock by another conversation
    const [existingLock] = await db.select().from(timeSlotLocks).where(
      and(
        eq(timeSlotLocks.bookingDate, bookingDate),
        eq(timeSlotLocks.startTime, startTime),
        gte(timeSlotLocks.expiresAt, now)
      )
    );

    if (existingLock) {
      // If same conversation holds the lock, extend it
      if (existingLock.conversationId === conversationId) {
        await db.update(timeSlotLocks)
          .set({ expiresAt, lockedAt: now })
          .where(eq(timeSlotLocks.id, existingLock.id));
        return true;
      }
      // Another conversation holds the lock
      return false;
    }

    // No active lock, create one
    try {
      await db.insert(timeSlotLocks).values({
        bookingDate,
        startTime,
        conversationId,
        expiresAt,
      });
      return true;
    } catch (error: any) {
      // Unique constraint violation - another process got the lock
      if (error.code === '23505') {
        return false;
      }
      throw error;
    }
  }

  async releaseTimeSlotLock(bookingDate: string, startTime: string, conversationId: string): Promise<void> {
    await db.delete(timeSlotLocks).where(
      and(
        eq(timeSlotLocks.bookingDate, bookingDate),
        eq(timeSlotLocks.startTime, startTime),
        eq(timeSlotLocks.conversationId, conversationId)
      )
    );
  }

  async cleanExpiredTimeSlotLocks(): Promise<number> {
    const now = new Date();
    const result = await db.delete(timeSlotLocks)
      .where(lte(timeSlotLocks.expiresAt, now))
      .returning();
    return result.length;
  }

  // GHL Sync Queue
  async getBookingsPendingSync(): Promise<Booking[]> {
    return await db.select().from(bookings)
      .where(eq(bookings.ghlSyncStatus, 'pending'))
      .orderBy(asc(bookings.createdAt));
  }

  async updateBookingSyncStatus(bookingId: number, status: string, ghlContactId?: string, ghlAppointmentId?: string): Promise<void> {
    const updates: any = { ghlSyncStatus: status };
    if (ghlContactId) updates.ghlContactId = ghlContactId;
    if (ghlAppointmentId) updates.ghlAppointmentId = ghlAppointmentId;

    await db.update(bookings).set(updates).where(eq(bookings.id, bookingId));
  }
}

export const storage = new DatabaseStorage();
