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
  serviceDurations,
  bookings,
  bookingItems,
  chatSettings,
  chatIntegrations,
  twilioSettings,
  telegramSettings,
  emailSettings,
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
  type ServiceDuration,
  type InsertServiceDuration,
  insertServiceDurationSchema,
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
  type EmailSettings,
  type InsertEmailSettings,
  type InsertConversation,
  type InsertConversationMessage,
  type InsertFaq,
  type InsertServiceArea,
  type InsertServiceAreaGroup,
  type InsertServiceAreaCity,
  type InsertIntegrationSettings,
  type InsertBlogPost,
  type InsertBlogSettings,
  blogGenerationJobs,
  type BlogGenerationJob,
  type InsertBlogGenerationJob,
  type TimeSlotLock,
  type InsertTimeSlotLock,
  type BookingItemOption,
  type BookingItemFrequency,
  type PriceBreakdown,
  type InsertCompanySettings,
  type BusinessHours,
  DEFAULT_BUSINESS_HOURS,
  staffMembers,
  staffServiceAbilities,
  staffAvailability,
  staffGoogleCalendar,
  staffAvailabilityOverrides,
  type StaffMember,
  type StaffServiceAbility,
  type StaffAvailability,
  type StaffGoogleCalendar,
  type StaffAvailabilityOverride,
  type InsertStaffMember,
  type InsertStaffServiceAbility,
  type InsertStaffAvailability,
  type InsertStaffGoogleCalendar,
  type InsertStaffAvailabilityOverride,
  notificationLogs,
  type NotificationLog,
  type InsertNotificationLog,
  contacts,
  type Contact,
  type InsertContact,
  recurringBookings,
  type RecurringBooking,
  type InsertRecurringBooking,
  type RecurringBookingWithDetails,
  insertRecurringBookingSchema,
  serviceBookingQuestions,
  type ServiceBookingQuestion,
  type InsertServiceBookingQuestion,
  calendarSyncQueue,
  type CalendarSyncHealth,
  type CalendarSyncJob,
} from "@shared/schema";
import { eq, and, or, gte, lte, inArray, desc, asc, sql, ne, isNull, like } from "drizzle-orm";
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
  getServiceFrequency(id: number): Promise<ServiceFrequency | undefined>;
  createServiceFrequency(frequency: InsertServiceFrequency): Promise<ServiceFrequency>;
  updateServiceFrequency(id: number, frequency: Partial<InsertServiceFrequency>): Promise<ServiceFrequency>;
  deleteServiceFrequency(id: number): Promise<void>;
  setServiceFrequencies(serviceId: number, frequencies: Omit<InsertServiceFrequency, 'serviceId'>[]): Promise<ServiceFrequency[]>;

  // Service Durations (Phase 23 SEED-029)
  getServiceDurations(serviceId: number): Promise<ServiceDuration[]>;
  getServiceDuration(id: number): Promise<ServiceDuration | undefined>; // Phase 30 DUR-05
  createServiceDuration(duration: InsertServiceDuration): Promise<ServiceDuration>;
  updateServiceDuration(id: number, data: Partial<InsertServiceDuration>): Promise<ServiceDuration>;
  deleteServiceDuration(id: number): Promise<void>;

  // Service Booking Questions (Phase 26 QUEST-01, QUEST-02)
  getServiceBookingQuestions(serviceId: number): Promise<ServiceBookingQuestion[]>;
  createServiceBookingQuestion(data: InsertServiceBookingQuestion): Promise<ServiceBookingQuestion>;
  updateServiceBookingQuestion(id: number, data: Partial<InsertServiceBookingQuestion>): Promise<ServiceBookingQuestion>;
  deleteServiceBookingQuestion(id: number): Promise<void>;

  // Bookings
  createBooking(booking: InsertBooking & { totalPrice: string, totalDurationMinutes: number, endTime: string, bookingItemsData?: any[], userId?: string | null }): Promise<Booking>;
  getBookings(limit?: number): Promise<Booking[]>;
  getBookingsByDate(date: string): Promise<Booking[]>;
  getBookingsByDateAndStaff(date: string, staffMemberId: number): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingByStripeSessionId(sessionId: string): Promise<Booking | undefined>;
  getBookingsByUserId(userId: string): Promise<Booking[]>;
  getClientBookings(userId: string, email: string): Promise<Booking[]>;
  updateBookingStripeFields(bookingId: number, stripeSessionId: string, stripePaymentStatus?: string): Promise<void>;
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

  // Email (Resend) Integration
  getEmailSettings(): Promise<EmailSettings | undefined>;
  saveEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<void>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  findOpenConversationByContact(phone?: string, email?: string, excludeId?: string): Promise<Conversation | undefined>;

  // Blog Posts
  getBlogPosts(status?: string, limit?: number, offset?: number): Promise<BlogPost[]>;
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

  // Blog Generation Jobs
  getBlogGenerationJobs(status?: string, limit?: number, offset?: number): Promise<BlogGenerationJob[]>;
  getBlogGenerationJob(id: number): Promise<BlogGenerationJob | undefined>;
  createBlogGenerationJob(job: InsertBlogGenerationJob): Promise<BlogGenerationJob>;
  updateBlogGenerationJob(id: number, updates: Partial<InsertBlogGenerationJob>): Promise<BlogGenerationJob>;
  acquireBlogGenerationLock(jobId: number, lockedBy: string, ttlMs?: number): Promise<boolean>;
  releaseBlogGenerationLock(jobId: number, lockedBy: string): Promise<void>;

  // Time Slot Locks
  acquireTimeSlotLock(bookingDate: string, startTime: string, conversationId: string, ttlMs?: number): Promise<boolean>;
  releaseTimeSlotLock(bookingDate: string, startTime: string, conversationId: string): Promise<void>;
  cleanExpiredTimeSlotLocks(): Promise<number>;

  // GHL Sync Queue
  getBookingsPendingSync(): Promise<Booking[]>;
  updateBookingSyncStatus(bookingId: number, status: string, ghlContactId?: string, ghlAppointmentId?: string): Promise<void>;

  // Staff Members
  getStaffMembers(includeInactive?: boolean): Promise<StaffMember[]>;
  getStaffMember(id: number): Promise<StaffMember | undefined>;
  getStaffMemberByUserId(userId: string): Promise<StaffMember | undefined>;
  linkStaffMemberToUser(staffId: number, userId: string): Promise<void>;
  getStaffCount(): Promise<number>;
  createStaffMember(staff: InsertStaffMember): Promise<StaffMember>;
  updateStaffMember(id: number, staff: Partial<InsertStaffMember>): Promise<StaffMember>;
  deleteStaffMember(id: number): Promise<void>;
  reorderStaffMembers(updates: { id: number; order: number }[]): Promise<void>;

  // Staff Service Abilities
  getStaffMembersByService(serviceId: number): Promise<StaffMember[]>;
  getServicesByStaffMember(staffMemberId: number): Promise<Service[]>;
  getStaffMembersByServiceId(serviceId: number): Promise<StaffMember[]>;
  setStaffServiceAbilities(staffMemberId: number, serviceIds: number[]): Promise<void>;

  // Staff Availability
  getStaffAvailability(staffMemberId: number): Promise<StaffAvailability[]>;
  setStaffAvailability(staffMemberId: number, availability: Omit<InsertStaffAvailability, 'staffMemberId'>[]): Promise<StaffAvailability[]>;

  // Staff Availability Overrides
  getStaffAvailabilityOverrides(staffMemberId: number): Promise<StaffAvailabilityOverride[]>;
  getStaffAvailabilityOverridesByDate(staffMemberId: number, date: string): Promise<StaffAvailabilityOverride | undefined>;
  createStaffAvailabilityOverride(data: InsertStaffAvailabilityOverride): Promise<StaffAvailabilityOverride>;
  deleteStaffAvailabilityOverride(id: number): Promise<void>;

  // Staff Google Calendar (optional integration)
  getStaffGoogleCalendar(staffMemberId: number): Promise<StaffGoogleCalendar | undefined>;
  upsertStaffGoogleCalendar(calendar: InsertStaffGoogleCalendar): Promise<StaffGoogleCalendar>;
  deleteStaffGoogleCalendar(staffMemberId: number): Promise<void>;
  markCalendarNeedsReconnect(staffMemberId: number): Promise<void>;
  clearCalendarNeedsReconnect(staffMemberId: number): Promise<void>;
  getAllCalendarStatuses(): Promise<Array<{
    staffMemberId: number;
    firstName: string;
    lastName: string;
    connected: boolean;
    needsReconnect: boolean;
    lastDisconnectedAt: Date | null;
  }>>;

  // Contacts
  getContact(id: number): Promise<Contact | undefined>;
  listContactsWithStats(search?: string, limit?: number): Promise<Contact[]>;
  upsertContact(data: Omit<InsertContact, 'updatedAt'>): Promise<Contact>;
  updateContact(id: number, data: Partial<InsertContact>): Promise<Contact>;
  updateBookingContactId(bookingId: number, contactId: number): Promise<void>;
  getContactBookings(contactId: number): Promise<Booking[]>;
  getBookingsByDateRange(from: string, to: string): Promise<Booking[]>;

  // Notification Logs
  createNotificationLog(entry: InsertNotificationLog): Promise<NotificationLog>;
  getNotificationLogsByConversation(conversationId: string): Promise<NotificationLog[]>;
  getNotificationLogsByBooking(bookingId: number): Promise<NotificationLog[]>;
  getNotificationLogs(filters: {
    channel?: string;
    status?: string;
    trigger?: string;
    search?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<NotificationLog[]>;

  // Recurring Bookings (Phase 27 RECUR-01)
  createRecurringBooking(data: InsertRecurringBooking): Promise<RecurringBooking>;
  getRecurringBooking(id: number): Promise<RecurringBooking | undefined>;
  getRecurringBookings(statusFilter?: string): Promise<RecurringBooking[]>;
  getActiveRecurringBookingsDueForGeneration(asOfDate: string): Promise<RecurringBooking[]>;
  updateRecurringBooking(id: number, data: Partial<Pick<RecurringBooking, 'status' | 'nextBookingDate' | 'cancelledAt' | 'pausedAt' | 'updatedAt'>>): Promise<RecurringBooking>;

  // Phase 29 RECUR-05: look up subscription by its manage_token UUID (public self-serve route)
  getRecurringBookingByToken(token: string): Promise<RecurringBooking | undefined>;

  // Phase 29 RECUR-04: admin panel — JOIN contacts + services to avoid N+1 secondary calls
  getRecurringBookingsWithDetails(): Promise<RecurringBookingWithDetails[]>;

  // Calendar Sync Queue (Phase 32)
  enqueueCalendarSync(bookingId: number, target: string, operation: string, payload?: object): Promise<void>;
  getCalendarSyncHealth(): Promise<CalendarSyncHealth[]>;
  retryCalendarSyncJob(jobId: number): Promise<void>;
  listRecentSyncFailures(target?: string, limit?: number): Promise<CalendarSyncJob[]>;
}

export class DatabaseStorage implements IStorage {
  private readonly tenantId: number;

  private constructor(tenantId: number) {
    this.tenantId = tenantId;
  }

  static forTenant(tenantId: number): DatabaseStorage {
    return new DatabaseStorage(tenantId);
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.tenantId, this.tenantId));
  }
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.tenantId, this.tenantId), eq(users.id, id)));
    return user;
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.tenantId, this.tenantId), eq(users.email, email)));
    return user;
  }
  async createUser(user: UpsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values({ ...user, tenantId: this.tenantId }).returning();
    return newUser;
  }
  async updateUser(id: string, user: Partial<UpsertUser>): Promise<User> {
    const [updated] = await db.update(users).set({ ...user, updatedAt: new Date() }).where(and(eq(users.tenantId, this.tenantId), eq(users.id, id))).returning();
    return updated;
  }
  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(and(eq(users.tenantId, this.tenantId), eq(users.id, id)));
  }

  private chatSchemaEnsured = false;
  private companySchemaEnsured = false;
  private conversationSchemaEnsured = false;

  async initializeRuntimeState(): Promise<void> {
    // WARNING: This method executes DDL operations (ALTER TABLE) which cause
    // 504 timeouts in serverless environments like Vercel.
    // 
    // DO NOT call this method in:
    // - api/handler.ts (Vercel serverless)
    // - server/index.ts startup
    //
    // Schema migrations should be done via `npm run db:push` during deployment.
    // This method is kept for manual execution in scripts (e.g., server/scripts/seed.ts)
    await Promise.all([
      this.ensureChatSchema(),
      this.ensureCompanySchema(),
      this.ensureConversationSchema(),
    ]);
  }

  private async ensureChatSchema(): Promise<void> {
    if (this.chatSchemaEnsured) return;
    try {
      // Core settings
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "enabled" boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "agent_name" text DEFAULT 'Assistant'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "agent_avatar_url" text DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "active_provider" text DEFAULT 'openai'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "language_selector_enabled" boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "default_language" text DEFAULT 'en'`);

      // Messages and prompts
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "welcome_message" text DEFAULT 'Hi! How can I help you today?'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "system_prompt" text DEFAULT 'You are our helpful chat assistant. Provide concise, friendly answers. Use the provided tools to fetch services, details, and availability. Do not guess prices or availability; always use tool data when relevant. If booking is requested, gather details and direct the user to the booking page at /booking.'`);

      // Calendar integration
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_provider" text DEFAULT 'gohighlevel'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_id" text DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_staff" jsonb DEFAULT '[]'`);

      // Intake and objectives
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "intake_objectives" jsonb DEFAULT '[]'`);

      // URL exclusions and visibility
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "excluded_url_rules" jsonb DEFAULT '[]'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "show_in_prod" boolean DEFAULT false`);

      // Knowledge base settings
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "use_knowledge_base" boolean DEFAULT true`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "use_faqs" boolean DEFAULT true`);

      // Timestamps
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now()`);

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
    return await db.select().from(categories).where(eq(categories.tenantId, this.tenantId)).orderBy(categories.order);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(and(eq(categories.tenantId, this.tenantId), eq(categories.slug, slug)));
    return category;
  }

  async getServices(categoryId?: number, subcategoryId?: number, includeHidden: boolean = false, showOnLanding?: boolean): Promise<Service[]> {
    const baseConditions = [
      eq(services.tenantId, this.tenantId),
      eq(services.isArchived, false),
    ];
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
      return await db.select().from(subcategories).where(and(eq(subcategories.tenantId, this.tenantId), eq(subcategories.categoryId, categoryId)));
    }
    return await db.select().from(subcategories).where(eq(subcategories.tenantId, this.tenantId));
  }

  async createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory> {
    const [newSubcategory] = await db.insert(subcategories).values({ ...subcategory, tenantId: this.tenantId }).returning();
    return newSubcategory;
  }

  async updateSubcategory(id: number, subcategory: Partial<InsertSubcategory>): Promise<Subcategory> {
    const [updated] = await db.update(subcategories).set(subcategory).where(and(eq(subcategories.tenantId, this.tenantId), eq(subcategories.id, id))).returning();
    return updated;
  }

  async deleteSubcategory(id: number): Promise<void> {
    await db.delete(subcategories).where(and(eq(subcategories.tenantId, this.tenantId), eq(subcategories.id, id)));
  }

  async getServiceAddons(serviceId: number): Promise<Service[]> {
    const addonRelations = await db.select().from(serviceAddons).where(and(eq(serviceAddons.tenantId, this.tenantId), eq(serviceAddons.serviceId, serviceId)));
    if (addonRelations.length === 0) return [];

    const addonIds = addonRelations.map(r => r.addonServiceId);
    return await db
      .select()
      .from(services)
      .where(and(eq(services.tenantId, this.tenantId), inArray(services.id, addonIds), eq(services.isArchived, false)));
  }

  async setServiceAddons(serviceId: number, addonServiceIds: number[]): Promise<void> {
    await db.delete(serviceAddons).where(and(eq(serviceAddons.tenantId, this.tenantId), eq(serviceAddons.serviceId, serviceId)));

    if (addonServiceIds.length > 0) {
      const values = addonServiceIds.map(addonId => ({
        tenantId: this.tenantId,
        serviceId,
        addonServiceId: addonId
      }));
      await db.insert(serviceAddons).values(values);
    }
  }

  async getAddonRelationships(): Promise<ServiceAddon[]> {
    return await db.select().from(serviceAddons).where(eq(serviceAddons.tenantId, this.tenantId));
  }

  // Service Options (for base_plus_addons pricing)
  async getServiceOptions(serviceId: number): Promise<ServiceOption[]> {
    return await db
      .select()
      .from(serviceOptions)
      .where(and(eq(serviceOptions.tenantId, this.tenantId), eq(serviceOptions.serviceId, serviceId)))
      .orderBy(asc(serviceOptions.order), asc(serviceOptions.id));
  }

  async createServiceOption(option: InsertServiceOption): Promise<ServiceOption> {
    const [newOption] = await db.insert(serviceOptions).values({ ...option, tenantId: this.tenantId }).returning();
    return newOption;
  }

  async updateServiceOption(id: number, option: Partial<InsertServiceOption>): Promise<ServiceOption> {
    const [updated] = await db.update(serviceOptions).set(option).where(and(eq(serviceOptions.tenantId, this.tenantId), eq(serviceOptions.id, id))).returning();
    return updated;
  }

  async deleteServiceOption(id: number): Promise<void> {
    await db.delete(serviceOptions).where(and(eq(serviceOptions.tenantId, this.tenantId), eq(serviceOptions.id, id)));
  }

  async setServiceOptions(serviceId: number, options: Omit<InsertServiceOption, 'serviceId'>[]): Promise<ServiceOption[]> {
    // Delete existing options
    await db.delete(serviceOptions).where(and(eq(serviceOptions.tenantId, this.tenantId), eq(serviceOptions.serviceId, serviceId)));

    if (options.length === 0) return [];

    // Insert new options
    const values = options.map((opt, index) => ({
      ...opt,
      serviceId,
      tenantId: this.tenantId,
      order: opt.order ?? index,
    }));
    return await db.insert(serviceOptions).values(values).returning();
  }

  // Service Frequencies (for base_plus_addons pricing)
  async getServiceFrequencies(serviceId: number): Promise<ServiceFrequency[]> {
    return await db
      .select()
      .from(serviceFrequencies)
      .where(and(eq(serviceFrequencies.tenantId, this.tenantId), eq(serviceFrequencies.serviceId, serviceId)))
      .orderBy(asc(serviceFrequencies.order), asc(serviceFrequencies.id));
  }

  async getServiceFrequency(id: number): Promise<ServiceFrequency | undefined> {
    const [freq] = await db
      .select()
      .from(serviceFrequencies)
      .where(and(eq(serviceFrequencies.tenantId, this.tenantId), eq(serviceFrequencies.id, id)))
      .limit(1);
    return freq;
  }

  async createServiceFrequency(frequency: InsertServiceFrequency): Promise<ServiceFrequency> {
    const [newFrequency] = await db.insert(serviceFrequencies).values({ ...frequency, tenantId: this.tenantId }).returning();
    return newFrequency;
  }

  async updateServiceFrequency(id: number, frequency: Partial<InsertServiceFrequency>): Promise<ServiceFrequency> {
    const [updated] = await db.update(serviceFrequencies).set(frequency).where(and(eq(serviceFrequencies.tenantId, this.tenantId), eq(serviceFrequencies.id, id))).returning();
    return updated;
  }

  async deleteServiceFrequency(id: number): Promise<void> {
    await db.delete(serviceFrequencies).where(and(eq(serviceFrequencies.tenantId, this.tenantId), eq(serviceFrequencies.id, id)));
  }

  async setServiceFrequencies(serviceId: number, frequencies: Omit<InsertServiceFrequency, 'serviceId'>[]): Promise<ServiceFrequency[]> {
    // Delete existing frequencies
    await db.delete(serviceFrequencies).where(and(eq(serviceFrequencies.tenantId, this.tenantId), eq(serviceFrequencies.serviceId, serviceId)));

    if (frequencies.length === 0) return [];

    // Insert new frequencies
    const values = frequencies.map((freq, index) => ({
      ...freq,
      serviceId,
      tenantId: this.tenantId,
      order: freq.order ?? index,
    }));
    return await db.insert(serviceFrequencies).values(values).returning();
  }

  // Service Durations (Phase 23 SEED-029)
  async getServiceDurations(serviceId: number): Promise<ServiceDuration[]> {
    return await db
      .select()
      .from(serviceDurations)
      .where(and(eq(serviceDurations.tenantId, this.tenantId), eq(serviceDurations.serviceId, serviceId)))
      .orderBy(asc(serviceDurations.order), asc(serviceDurations.id));
  }

  async getServiceDuration(id: number): Promise<ServiceDuration | undefined> {
    const [row] = await db.select().from(serviceDurations).where(and(eq(serviceDurations.tenantId, this.tenantId), eq(serviceDurations.id, id)));
    return row;
  }

  async createServiceDuration(duration: InsertServiceDuration): Promise<ServiceDuration> {
    const [newDuration] = await db.insert(serviceDurations).values({ ...duration, tenantId: this.tenantId }).returning();
    return newDuration;
  }

  async updateServiceDuration(id: number, data: Partial<InsertServiceDuration>): Promise<ServiceDuration> {
    const [updated] = await db
      .update(serviceDurations)
      .set(data)
      .where(and(eq(serviceDurations.tenantId, this.tenantId), eq(serviceDurations.id, id)))
      .returning();
    if (!updated) throw new Error(`ServiceDuration ${id} not found`);
    return updated;
  }

  async deleteServiceDuration(id: number): Promise<void> {
    await db.delete(serviceDurations).where(and(eq(serviceDurations.tenantId, this.tenantId), eq(serviceDurations.id, id)));
  }

  async getServiceBookingQuestions(serviceId: number): Promise<ServiceBookingQuestion[]> {
    return await db
      .select()
      .from(serviceBookingQuestions)
      .where(and(eq(serviceBookingQuestions.tenantId, this.tenantId), eq(serviceBookingQuestions.serviceId, serviceId)))
      .orderBy(asc(serviceBookingQuestions.order), asc(serviceBookingQuestions.id));
  }

  async createServiceBookingQuestion(data: InsertServiceBookingQuestion): Promise<ServiceBookingQuestion> {
    const [row] = await db.insert(serviceBookingQuestions).values({ ...data, tenantId: this.tenantId }).returning();
    return row;
  }

  async updateServiceBookingQuestion(id: number, data: Partial<InsertServiceBookingQuestion>): Promise<ServiceBookingQuestion> {
    const [updated] = await db
      .update(serviceBookingQuestions)
      .set(data)
      .where(and(eq(serviceBookingQuestions.tenantId, this.tenantId), eq(serviceBookingQuestions.id, id)))
      .returning();
    if (!updated) throw new Error(`ServiceBookingQuestion ${id} not found`);
    return updated;
  }

  async deleteServiceBookingQuestion(id: number): Promise<void> {
    await db.delete(serviceBookingQuestions).where(and(eq(serviceBookingQuestions.tenantId, this.tenantId), eq(serviceBookingQuestions.id, id)));
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db
      .select()
      .from(services)
      .where(and(eq(services.tenantId, this.tenantId), eq(services.id, id), eq(services.isArchived, false)));
    return service;
  }

  async createBooking(booking: InsertBooking & { totalPrice: string, totalDurationMinutes: number, endTime: string, bookingItemsData?: any[], userId?: string | null }): Promise<Booking> {
    // Use transaction to ensure booking and items are created atomically
    return await db.transaction(async (tx) => {
      // 1. Create Booking
      const [newBooking] = await tx.insert(bookings).values({
        tenantId: this.tenantId,
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
        userId: booking.userId ?? null,
      }).returning();

      // 2. Create Booking Items
      // Support both legacy format (serviceIds) and new format (cartItems/bookingItemsData)
      if (booking.bookingItemsData && booking.bookingItemsData.length > 0) {
        // New format with detailed pricing info
        for (const item of booking.bookingItemsData) {
          await tx.insert(bookingItems).values({
            tenantId: this.tenantId,
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
              tenantId: this.tenantId,
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
    return await db.select().from(bookings).where(eq(bookings.tenantId, this.tenantId)).orderBy(desc(bookings.bookingDate)).limit(limit);
  }

  async getBookingsByDate(date: string): Promise<Booking[]> {
    return await db.select().from(bookings).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.bookingDate, date)));
  }

  async getBookingsByDateAndStaff(date: string, staffMemberId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(
      and(
        eq(bookings.tenantId, this.tenantId),
        eq(bookings.bookingDate, date),
        eq(bookings.staffMemberId, staffMemberId)
      )
    );
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.id, id)));
    return booking;
  }

  async getBookingByStripeSessionId(sessionId: string): Promise<Booking | undefined> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.stripeSessionId, sessionId)))
      .limit(1);
    return booking;
  }

  async getBookingsByUserId(userId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.userId, userId)))
      .orderBy(desc(bookings.createdAt));
  }

  async getClientBookings(userId: string, email: string): Promise<Booking[]> {
    const [byUserId, byEmail] = await Promise.all([
      db.select().from(bookings).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.userId, userId))),
      db.select().from(bookings).where(
        and(eq(bookings.tenantId, this.tenantId), isNull(bookings.userId), eq(bookings.customerEmail, email))
      ),
    ]);
    const seen = new Set<number>();
    const merged = [...byUserId, ...byEmail].filter(b => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
    merged.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    return merged;
  }

  async updateBookingStripeFields(bookingId: number, stripeSessionId: string, stripePaymentStatus?: string): Promise<void> {
    await db
      .update(bookings)
      .set({
        stripeSessionId,
        ...(stripePaymentStatus ? { stripePaymentStatus } : {}),
      })
      .where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.id, bookingId)));
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
      staffMemberId: number | null;
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
        [updated] = await tx.update(bookings).set(bookingUpdates).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.id, id))).returning();
      }

      if (items) {
        await tx.delete(bookingItems).where(and(eq(bookingItems.tenantId, this.tenantId), eq(bookingItems.bookingId, id)));
        for (const item of items) {
          await tx.insert(bookingItems).values({
            tenantId: this.tenantId,
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
        const [existing] = await tx.select().from(bookings).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.id, id)));
        return existing;
      }

      return updated;
    });
  }

  async deleteBooking(id: number): Promise<void> {
    // First delete booking items
    await db.delete(bookingItems).where(and(eq(bookingItems.tenantId, this.tenantId), eq(bookingItems.bookingId, id)));
    // Then delete the booking
    await db.delete(bookings).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.id, id)));
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking> {
    const [updated] = await db.update(bookings).set({ status }).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.id, id))).returning();
    return updated;
  }

  async getBookingItems(bookingId: number): Promise<BookingItem[]> {
    return await db.select().from(bookingItems).where(and(eq(bookingItems.tenantId, this.tenantId), eq(bookingItems.bookingId, bookingId)));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values({ ...category, tenantId: this.tenantId }).returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updated] = await db.update(categories).set(category).where(and(eq(categories.tenantId, this.tenantId), eq(categories.id, id))).returning();
    return updated;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(and(eq(categories.tenantId, this.tenantId), eq(categories.id, id)));
  }

  async createService(service: InsertService): Promise<Service> {
    let nextOrder = service.order;
    if (nextOrder === undefined || nextOrder === null) {
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${services.order}), 0)` })
        .from(services)
        .where(eq(services.tenantId, this.tenantId));
      nextOrder = Number(maxOrder ?? 0) + 1;
    }
    const [newService] = await db.insert(services).values({ ...service, order: nextOrder, tenantId: this.tenantId }).returning();
    return newService;
  }

  async updateService(id: number, service: Partial<InsertService>): Promise<Service> {
    const [updated] = await db.update(services).set(service).where(and(eq(services.tenantId, this.tenantId), eq(services.id, id))).returning();
    return updated;
  }

  async deleteService(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(serviceAddons).where(and(eq(serviceAddons.tenantId, this.tenantId), eq(serviceAddons.serviceId, id)));
      await tx.delete(serviceAddons).where(and(eq(serviceAddons.tenantId, this.tenantId), eq(serviceAddons.addonServiceId, id)));
      await tx.delete(serviceOptions).where(and(eq(serviceOptions.tenantId, this.tenantId), eq(serviceOptions.serviceId, id)));
      await tx.delete(serviceFrequencies).where(and(eq(serviceFrequencies.tenantId, this.tenantId), eq(serviceFrequencies.serviceId, id)));
      await tx.delete(blogPostServices).where(eq(blogPostServices.serviceId, id));
      await tx.update(services).set({ isArchived: true }).where(and(eq(services.tenantId, this.tenantId), eq(services.id, id)));
    });
  }

  async reorderServices(order: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const item of order) {
        await tx.update(services).set({ order: item.order }).where(and(eq(services.tenantId, this.tenantId), eq(services.id, item.id)));
      }
    });
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const [settings] = await db.select().from(companySettings).where(eq(companySettings.tenantId, this.tenantId));
    if (settings) return settings;

    // Create default settings if none exist
    const [newSettings] = await db.insert(companySettings).values({ tenantId: this.tenantId }).returning();
    return newSettings;
  }

  async updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();
    const [updated] = await db.update(companySettings).set(settings).where(and(eq(companySettings.tenantId, this.tenantId), eq(companySettings.id, existing.id))).returning();
    return updated;
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
      return await db.select().from(faqs).where(eq(faqs.tenantId, this.tenantId)).orderBy(faqs.order);
    }
    return await db.select().from(faqs).where(and(eq(faqs.tenantId, this.tenantId), eq(faqs.isActive, true))).orderBy(faqs.order);
  }

  async createFaq(faq: InsertFaq): Promise<Faq> {
    const [newFaq] = await db.insert(faqs).values({ ...faq, tenantId: this.tenantId }).returning();
    return newFaq;
  }

  async updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq> {
    const [updated] = await db.update(faqs).set(faq).where(and(eq(faqs.tenantId, this.tenantId), eq(faqs.id, id))).returning();
    return updated;
  }

  async deleteFaq(id: number): Promise<void> {
    await db.delete(faqs).where(and(eq(faqs.tenantId, this.tenantId), eq(faqs.id, id)));
  }

  async getServiceAreas(includeInactive: boolean = false): Promise<ServiceArea[]> {
    if (includeInactive) {
      return await db.select().from(serviceAreas).where(eq(serviceAreas.tenantId, this.tenantId)).orderBy(serviceAreas.order);
    }
    return await db.select().from(serviceAreas).where(and(eq(serviceAreas.tenantId, this.tenantId), eq(serviceAreas.isActive, true))).orderBy(serviceAreas.order);
  }

  async createServiceArea(area: InsertServiceArea): Promise<ServiceArea> {
    const [newArea] = await db.insert(serviceAreas).values({ ...area, tenantId: this.tenantId }).returning();
    return newArea;
  }

  async updateServiceArea(id: number, area: Partial<InsertServiceArea>): Promise<ServiceArea> {
    const [updated] = await db.update(serviceAreas).set(area).where(and(eq(serviceAreas.tenantId, this.tenantId), eq(serviceAreas.id, id))).returning();
    if (!updated) throw new Error('Service area not found');
    return updated;
  }

  async deleteServiceArea(id: number): Promise<void> {
    await db.delete(serviceAreas).where(and(eq(serviceAreas.tenantId, this.tenantId), eq(serviceAreas.id, id)));
  }

  async reorderServiceAreas(updates: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(serviceAreas)
          .set({ order: update.order })
          .where(and(eq(serviceAreas.tenantId, this.tenantId), eq(serviceAreas.id, update.id)));
      }
    });
  }

  // === Service Area Groups (Hierarchical) ===
  async getServiceAreaGroups(includeInactive: boolean = false): Promise<ServiceAreaGroup[]> {
    if (includeInactive) {
      return await db.select().from(serviceAreaGroups).where(eq(serviceAreaGroups.tenantId, this.tenantId)).orderBy(serviceAreaGroups.order);
    }
    return await db.select().from(serviceAreaGroups).where(and(eq(serviceAreaGroups.tenantId, this.tenantId), eq(serviceAreaGroups.isActive, true))).orderBy(serviceAreaGroups.order);
  }

  async createServiceAreaGroup(group: InsertServiceAreaGroup): Promise<ServiceAreaGroup> {
    const [newGroup] = await db.insert(serviceAreaGroups).values({ ...group, tenantId: this.tenantId }).returning();
    return newGroup;
  }

  // Blog Settings
  async getBlogSettings(): Promise<BlogSettings | undefined> {
    const [settings] = await db.select().from(blogSettings)
      .where(eq(blogSettings.tenantId, this.tenantId));
    return settings;
  }

  async upsertBlogSettings(settings: InsertBlogSettings): Promise<BlogSettings> {
    const existing = await this.getBlogSettings();
    if (existing) {
      const [updated] = await db.update(blogSettings).set({ ...settings, updatedAt: new Date() }).where(and(eq(blogSettings.tenantId, this.tenantId), eq(blogSettings.id, existing.id))).returning();
      return updated;
    } else {
      const [created] = await db.insert(blogSettings).values({ ...settings, tenantId: this.tenantId }).returning();
      return created;
    }
  }

  // Blog Generation Jobs
  async getBlogGenerationJobs(status?: string, limit: number = 50, offset: number = 0): Promise<BlogGenerationJob[]> {
    const conditions: any[] = [eq(blogGenerationJobs.tenantId, this.tenantId)];
    if (status) conditions.push(eq(blogGenerationJobs.status, status));
    return await db.select().from(blogGenerationJobs)
      .where(and(...conditions))
      .orderBy(desc(blogGenerationJobs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getBlogGenerationJob(id: number): Promise<BlogGenerationJob | undefined> {
    const [job] = await db.select().from(blogGenerationJobs)
      .where(and(eq(blogGenerationJobs.tenantId, this.tenantId), eq(blogGenerationJobs.id, id)));
    return job;
  }

  async createBlogGenerationJob(job: InsertBlogGenerationJob): Promise<BlogGenerationJob> {
    const [created] = await db.insert(blogGenerationJobs).values({ ...job, tenantId: this.tenantId }).returning();
    return created;
  }

  async updateBlogGenerationJob(id: number, updates: Partial<InsertBlogGenerationJob>): Promise<BlogGenerationJob> {
    const [updated] = await db.update(blogGenerationJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(blogGenerationJobs.tenantId, this.tenantId), eq(blogGenerationJobs.id, id)))
      .returning();
    if (!updated) throw new Error('Blog generation job not found');
    return updated;
  }

  async acquireBlogGenerationLock(jobId: number, lockedBy: string, ttlMs: number = 300000): Promise<boolean> {
    const now = new Date();

    // Clean up expired locks first (scoped to tenant)
    await db.update(blogGenerationJobs)
      .set({ lockedAt: null, lockedBy: null })
      .where(
        and(
          eq(blogGenerationJobs.tenantId, this.tenantId),
          eq(blogGenerationJobs.lockedBy, lockedBy),
          lte(blogGenerationJobs.lockedAt, new Date(Date.now() - ttlMs))
        )
      );

    // Try to acquire lock on this specific job (scoped to tenant)
    const [existing] = await db.select().from(blogGenerationJobs)
      .where(and(eq(blogGenerationJobs.tenantId, this.tenantId), eq(blogGenerationJobs.id, jobId)))
      .limit(1);

    if (!existing) return false;
    if (existing.lockedAt && new Date(existing.lockedAt).getTime() > Date.now() - ttlMs) {
      // Lock is held by someone else and hasn't expired
      return false;
    }

    // Acquire the lock
    const [updated] = await db.update(blogGenerationJobs)
      .set({ lockedAt: now, lockedBy, status: 'running', startedAt: now })
      .where(and(eq(blogGenerationJobs.tenantId, this.tenantId), eq(blogGenerationJobs.id, jobId)))
      .returning();

    return !!updated;
  }

  async releaseBlogGenerationLock(jobId: number, lockedBy: string): Promise<void> {
    await db.update(blogGenerationJobs)
      .set({ lockedAt: null, lockedBy: null })
      .where(
        and(
          eq(blogGenerationJobs.tenantId, this.tenantId),
          eq(blogGenerationJobs.id, jobId),
          eq(blogGenerationJobs.lockedBy, lockedBy)
        )
      );
  }

  async updateServiceAreaGroup(id: number, group: Partial<InsertServiceAreaGroup>): Promise<ServiceAreaGroup> {
    const [updated] = await db.update(serviceAreaGroups).set(group).where(and(eq(serviceAreaGroups.tenantId, this.tenantId), eq(serviceAreaGroups.id, id))).returning();
    if (!updated) throw new Error('Service area group not found');
    return updated;
  }

  async deleteServiceAreaGroup(id: number): Promise<void> {
    // Check if group has cities
    const cities = await db.select().from(serviceAreaCities).where(and(eq(serviceAreaCities.tenantId, this.tenantId), eq(serviceAreaCities.areaGroupId, id)));
    if (cities.length > 0) {
      throw new Error(`Cannot delete area group with ${cities.length} cities. Delete or reassign cities first.`);
    }
    await db.delete(serviceAreaGroups).where(and(eq(serviceAreaGroups.tenantId, this.tenantId), eq(serviceAreaGroups.id, id)));
  }

  async reorderServiceAreaGroups(updates: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(serviceAreaGroups)
          .set({ order: update.order })
          .where(and(eq(serviceAreaGroups.tenantId, this.tenantId), eq(serviceAreaGroups.id, update.id)));
      }
    });
  }

  // === Service Area Cities (Hierarchical) ===
  async getServiceAreaCities(groupId?: number, includeInactive: boolean = false): Promise<ServiceAreaCity[]> {
    let query = db.select().from(serviceAreaCities);

    const conditions: any[] = [eq(serviceAreaCities.tenantId, this.tenantId)];
    if (groupId) {
      conditions.push(eq(serviceAreaCities.areaGroupId, groupId));
    }
    if (!includeInactive) {
      conditions.push(eq(serviceAreaCities.isActive, true));
    }

    query = query.where(and(...conditions)) as any;

    return await query.orderBy(serviceAreaCities.order);
  }

  async createServiceAreaCity(city: InsertServiceAreaCity): Promise<ServiceAreaCity> {
    const [newCity] = await db.insert(serviceAreaCities).values({ ...city, tenantId: this.tenantId }).returning();
    return newCity;
  }

  async updateServiceAreaCity(id: number, city: Partial<InsertServiceAreaCity>): Promise<ServiceAreaCity> {
    const [updated] = await db.update(serviceAreaCities).set(city).where(and(eq(serviceAreaCities.tenantId, this.tenantId), eq(serviceAreaCities.id, id))).returning();
    if (!updated) throw new Error('Service area city not found');
    return updated;
  }

  async deleteServiceAreaCity(id: number): Promise<void> {
    await db.delete(serviceAreaCities).where(and(eq(serviceAreaCities.tenantId, this.tenantId), eq(serviceAreaCities.id, id)));
  }

  async reorderServiceAreaCities(updates: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(serviceAreaCities)
          .set({ order: update.order })
          .where(and(eq(serviceAreaCities.tenantId, this.tenantId), eq(serviceAreaCities.id, update.id)));
      }
    });
  }

  async getIntegrationSettings(provider: string): Promise<IntegrationSettings | undefined> {
    const [settings] = await db.select().from(integrationSettings).where(and(eq(integrationSettings.tenantId, this.tenantId), eq(integrationSettings.provider, provider)));
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
        .where(and(eq(integrationSettings.tenantId, this.tenantId), eq(integrationSettings.id, existing.id)))
        .returning();
      console.log(`Storage: updated settings for ${provider}:`, { ...updated, apiKey: updated.apiKey ? 'masked' : 'none' });
      return updated;
    } else {
      console.log(`Storage: creating new settings for ${provider}`);
      const [created] = await db.insert(integrationSettings).values({ ...settings, tenantId: this.tenantId }).returning();
      console.log(`Storage: created settings for ${provider}:`, { ...created, apiKey: created.apiKey ? 'masked' : 'none' });
      return created;
    }
  }

  async updateBookingGHLSync(bookingId: number, ghlContactId: string, ghlAppointmentId: string, syncStatus: string): Promise<void> {
    await db
      .update(bookings)
      .set({ ghlContactId, ghlAppointmentId, ghlSyncStatus: syncStatus })
      .where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.id, bookingId)));
  }

  async getChatSettings(): Promise<ChatSettings> {
    const [settings] = await db.select().from(chatSettings)
      .where(eq(chatSettings.tenantId, this.tenantId))
      .limit(1);
    if (settings) return settings;

    // No settings found - create default row (singleton pattern)
    try {
      const [created] = await db.insert(chatSettings).values({ tenantId: this.tenantId }).returning();
      if (!created) {
        throw new Error("Failed to create default chat settings");
      }
      console.log("Created default chat settings row");
      return created;
    } catch (insertErr: any) {
      // If insert fails due to existing row (race condition), try to fetch again
      if (insertErr.message?.includes("duplicate") || insertErr.code === '23505') {
        const [settings] = await db.select().from(chatSettings)
          .where(eq(chatSettings.tenantId, this.tenantId))
          .limit(1);
        if (settings) return settings;
      }
      throw insertErr;
    }
  }

  async updateChatSettings(settings: Partial<InsertChatSettings>): Promise<ChatSettings> {
    const existing = await this.getChatSettings();
    const [updated] = await db
      .update(chatSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(and(eq(chatSettings.tenantId, this.tenantId), eq(chatSettings.id, existing.id)))
      .returning();
    return updated;
  }

  async getChatIntegration(provider: string): Promise<ChatIntegrations | undefined> {
    const normalizedProvider = (provider || "openai").trim().toLowerCase();
    const [integration] = await db
      .select()
      .from(chatIntegrations)
      .where(and(eq(chatIntegrations.tenantId, this.tenantId), eq(chatIntegrations.provider, normalizedProvider)))
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

      // Update by tenant + provider to keep legacy duplicate rows consistent.
      await db
        .update(chatIntegrations)
        .set(payload)
        .where(and(eq(chatIntegrations.tenantId, this.tenantId), eq(chatIntegrations.provider, provider)));

      const updated = await this.getChatIntegration(provider);
      if (!updated) {
        throw new Error(`Failed to update chat integration for provider ${provider}`);
      }
      return updated;
    }

    const [created] = await db
      .insert(chatIntegrations)
      .values({ ...settings, provider, tenantId: this.tenantId })
      .returning();
    return created;
  }

  async getTwilioSettings(): Promise<TwilioSettings | undefined> {
    const [settings] = await db.select().from(twilioSettings)
      .where(eq(twilioSettings.tenantId, this.tenantId))
      .limit(1);
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
        .where(and(eq(twilioSettings.tenantId, this.tenantId), eq(twilioSettings.id, existing.id)))
        .returning();
      return updated;
    }

    const [created] = await db.insert(twilioSettings).values({ ...settings, tenantId: this.tenantId }).returning();
    return created;
  }

  async getTelegramSettings(): Promise<TelegramSettings | undefined> {
    const [settings] = await db.select().from(telegramSettings)
      .where(eq(telegramSettings.tenantId, this.tenantId))
      .limit(1);
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
        .where(and(eq(telegramSettings.tenantId, this.tenantId), eq(telegramSettings.id, existing.id)))
        .returning();
      return updated;
    }

    const [created] = await db.insert(telegramSettings).values({ ...settings, tenantId: this.tenantId }).returning();
    return created;
  }

  async getEmailSettings(): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings)
      .where(eq(emailSettings.tenantId, this.tenantId))
      .limit(1);
    return settings;
  }

  async saveEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings> {
    const existing = await this.getEmailSettings();
    if (existing) {
      const [updated] = await db
        .update(emailSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(and(eq(emailSettings.tenantId, this.tenantId), eq(emailSettings.id, existing.id)))
        .returning();
      return updated;
    }
    const [created] = await db.insert(emailSettings).values({ ...settings, tenantId: this.tenantId }).returning();
    return created;
  }

  async getConversations(): Promise<Conversation[]> {
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

    return await db
      .select({
        id: conversations.id,
        tenantId: conversations.tenantId,
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
      .where(eq(conversations.tenantId, this.tenantId))
      .orderBy(desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations)
      .where(and(eq(conversations.tenantId, this.tenantId), eq(conversations.id, id)));
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const [updated] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(conversations.tenantId, this.tenantId), eq(conversations.id, id)))
      .returning();
    return updated;
  }

  async deleteConversation(id: string): Promise<void> {
    await db.delete(conversationMessages).where(and(eq(conversationMessages.tenantId, this.tenantId), eq(conversationMessages.conversationId, id)));
    await db.delete(conversations).where(and(eq(conversations.tenantId, this.tenantId), eq(conversations.id, id)));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [created] = await db.insert(conversations).values({ ...conversation, tenantId: this.tenantId }).returning();
    return created;
  }

  async addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const [created] = await db.insert(conversationMessages).values({ ...message, tenantId: this.tenantId }).returning();

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
      .where(and(eq(conversationMessages.tenantId, this.tenantId), eq(conversationMessages.conversationId, conversationId)))
      .orderBy(asc(conversationMessages.createdAt));
  }

  async findOpenConversationByContact(phone?: string, email?: string, excludeId?: string): Promise<Conversation | undefined> {
    if (!phone && !email) return undefined;

    const conditions: any[] = [
      eq(conversations.tenantId, this.tenantId),
      eq(conversations.status, 'open'),
    ];

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

  async getBlogPosts(status?: string, limit?: number, offset: number = 0): Promise<BlogPost[]> {
    const conditions: any[] = [eq(blogPosts.tenantId, this.tenantId)];
    if (status) conditions.push(eq(blogPosts.status, status));
    let query = db.select().from(blogPosts).where(and(...conditions)).orderBy(desc(blogPosts.createdAt));
    if (limit) {
      return await query.limit(limit).offset(offset);
    }
    return await query;
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts)
      .where(and(eq(blogPosts.tenantId, this.tenantId), eq(blogPosts.id, id)));
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts)
      .where(and(eq(blogPosts.tenantId, this.tenantId), eq(blogPosts.slug, slug)));
    return post;
  }

  async getPublishedBlogPosts(limit: number = 10, offset: number = 0): Promise<BlogPost[]> {
    return await db.select()
      .from(blogPosts)
      .where(and(eq(blogPosts.tenantId, this.tenantId), eq(blogPosts.status, 'published')))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  async getRelatedBlogPosts(postId: number, limit: number = 4): Promise<BlogPost[]> {
    return await db.select()
      .from(blogPosts)
      .where(and(
        eq(blogPosts.tenantId, this.tenantId),
        eq(blogPosts.status, 'published'),
        ne(blogPosts.id, postId)
      ))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit);
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const { serviceIds, ...postData } = post;
    const [newPost] = await db.insert(blogPosts).values({ ...postData, tenantId: this.tenantId }).returning();

    if (serviceIds && serviceIds.length > 0) {
      await this.setBlogPostServices(newPost.id, serviceIds);
    }

    return newPost;
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost> {
    const { serviceIds, ...postData } = post;
    const [updated] = await db.update(blogPosts)
      .set({ ...postData, updatedAt: new Date() })
      .where(and(eq(blogPosts.tenantId, this.tenantId), eq(blogPosts.id, id)))
      .returning();

    if (serviceIds !== undefined) {
      await this.setBlogPostServices(id, serviceIds);
    }

    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPostServices).where(and(eq(blogPostServices.tenantId, this.tenantId), eq(blogPostServices.blogPostId, id)));
    await db.delete(blogPosts).where(and(eq(blogPosts.tenantId, this.tenantId), eq(blogPosts.id, id)));
  }

  async getBlogPostServices(postId: number): Promise<Service[]> {
    const relations = await db.select().from(blogPostServices)
      .where(and(eq(blogPostServices.tenantId, this.tenantId), eq(blogPostServices.blogPostId, postId)));
    if (relations.length === 0) return [];

    const serviceIds = relations.map(r => r.serviceId);
    return await db.select().from(services).where(and(eq(services.tenantId, this.tenantId), inArray(services.id, serviceIds)));
  }

  async setBlogPostServices(postId: number, serviceIds: number[]): Promise<void> {
    await db.delete(blogPostServices).where(and(eq(blogPostServices.tenantId, this.tenantId), eq(blogPostServices.blogPostId, postId)));

    if (serviceIds.length > 0) {
      const values = serviceIds.map(serviceId => ({
        tenantId: this.tenantId,
        blogPostId: postId,
        serviceId
      }));
      await db.insert(blogPostServices).values(values);
    }
  }

  async countPublishedBlogPosts(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(and(eq(blogPosts.tenantId, this.tenantId), eq(blogPosts.status, 'published')));
    return Number(result[0]?.count || 0);
  }


  // Time Slot Locks - Persistent implementation
  async acquireTimeSlotLock(bookingDate: string, startTime: string, conversationId: string, ttlMs: number = 30000): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // First, clean up any expired locks for this slot (scoped to tenant)
    await db.delete(timeSlotLocks).where(
      and(
        eq(timeSlotLocks.tenantId, this.tenantId),
        eq(timeSlotLocks.bookingDate, bookingDate),
        eq(timeSlotLocks.startTime, startTime),
        lte(timeSlotLocks.expiresAt, now)
      )
    );

    // Check if there's an active lock by another conversation (scoped to tenant)
    const [existingLock] = await db.select().from(timeSlotLocks).where(
      and(
        eq(timeSlotLocks.tenantId, this.tenantId),
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
          .where(and(eq(timeSlotLocks.tenantId, this.tenantId), eq(timeSlotLocks.id, existingLock.id)));
        return true;
      }
      // Another conversation holds the lock
      return false;
    }

    // No active lock, create one
    try {
      await db.insert(timeSlotLocks).values({
        tenantId: this.tenantId,
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
        eq(timeSlotLocks.tenantId, this.tenantId),
        eq(timeSlotLocks.bookingDate, bookingDate),
        eq(timeSlotLocks.startTime, startTime),
        eq(timeSlotLocks.conversationId, conversationId)
      )
    );
  }

  async cleanExpiredTimeSlotLocks(): Promise<number> {
    const now = new Date();
    const result = await db.delete(timeSlotLocks)
      .where(and(eq(timeSlotLocks.tenantId, this.tenantId), lte(timeSlotLocks.expiresAt, now)))
      .returning();
    return result.length;
  }

  // GHL Sync Queue
  async getBookingsPendingSync(): Promise<Booking[]> {
    return await db.select().from(bookings)
      .where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.ghlSyncStatus, 'pending')))
      .orderBy(asc(bookings.createdAt));
  }

  async updateBookingSyncStatus(bookingId: number, status: string, ghlContactId?: string, ghlAppointmentId?: string): Promise<void> {
    const updates: any = { ghlSyncStatus: status };
    if (ghlContactId) updates.ghlContactId = ghlContactId;
    if (ghlAppointmentId) updates.ghlAppointmentId = ghlAppointmentId;

    await db.update(bookings).set(updates).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.id, bookingId)));
  }

  // ─── Staff Members ────────────────────────────────────────────────────────

  async getStaffMembers(includeInactive = false): Promise<StaffMember[]> {
    if (!includeInactive) {
      return await db.select().from(staffMembers)
        .where(and(eq(staffMembers.tenantId, this.tenantId), eq(staffMembers.isActive, true)))
        .orderBy(asc(staffMembers.order));
    }
    return await db.select().from(staffMembers)
      .where(eq(staffMembers.tenantId, this.tenantId))
      .orderBy(asc(staffMembers.order));
  }

  async getStaffMember(id: number): Promise<StaffMember | undefined> {
    const [member] = await db.select().from(staffMembers)
      .where(and(eq(staffMembers.tenantId, this.tenantId), eq(staffMembers.id, id)));
    return member;
  }

  async getStaffMemberByUserId(userId: string): Promise<StaffMember | undefined> {
    const [member] = await db.select().from(staffMembers)
      .where(and(eq(staffMembers.tenantId, this.tenantId), eq(staffMembers.userId, userId)));
    return member;
  }

  async linkStaffMemberToUser(staffId: number, userId: string): Promise<void> {
    await db.update(staffMembers).set({ userId })
      .where(and(eq(staffMembers.tenantId, this.tenantId), eq(staffMembers.id, staffId)));
  }

  async getStaffCount(): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(staffMembers)
      .where(and(eq(staffMembers.tenantId, this.tenantId), eq(staffMembers.isActive, true)));
    return row?.count ?? 0;
  }

  async createStaffMember(staff: InsertStaffMember): Promise<StaffMember> {
    const [created] = await db.insert(staffMembers).values({ ...staff, tenantId: this.tenantId }).returning();
    return created;
  }

  async updateStaffMember(id: number, staff: Partial<InsertStaffMember>): Promise<StaffMember> {
    const [updated] = await db.update(staffMembers)
      .set({ ...staff, updatedAt: new Date() })
      .where(and(eq(staffMembers.tenantId, this.tenantId), eq(staffMembers.id, id)))
      .returning();
    return updated;
  }

  async deleteStaffMember(id: number): Promise<void> {
    await db.delete(staffMembers).where(and(eq(staffMembers.tenantId, this.tenantId), eq(staffMembers.id, id)));
  }

  async reorderStaffMembers(updates: { id: number; order: number }[]): Promise<void> {
    await Promise.all(
      updates.map(({ id, order }) =>
        db.update(staffMembers).set({ order }).where(and(eq(staffMembers.tenantId, this.tenantId), eq(staffMembers.id, id)))
      )
    );
  }

  // ─── Staff Service Abilities ───────────────────────────────────────────────

  async getStaffMembersByService(serviceId: number): Promise<StaffMember[]> {
    const rows = await db
      .select({ staffMembers })
      .from(staffMembers)
      .innerJoin(staffServiceAbilities, eq(staffServiceAbilities.staffMemberId, staffMembers.id))
      .where(and(
        eq(staffServiceAbilities.tenantId, this.tenantId),
        eq(staffServiceAbilities.serviceId, serviceId),
        eq(staffMembers.isActive, true)
      ))
      .orderBy(asc(staffMembers.order));
    return rows.map(r => r.staffMembers);
  }

  async getServicesByStaffMember(staffMemberId: number): Promise<Service[]> {
    const rows = await db
      .select({ services })
      .from(services)
      .innerJoin(staffServiceAbilities, eq(staffServiceAbilities.serviceId, services.id))
      .where(and(
        eq(staffServiceAbilities.tenantId, this.tenantId),
        eq(staffServiceAbilities.staffMemberId, staffMemberId)
      ));
    return rows.map(r => r.services);
  }

  async getStaffMembersByServiceId(serviceId: number): Promise<StaffMember[]> {
    const rows = await db
      .select({ staffMembers })
      .from(staffMembers)
      .innerJoin(staffServiceAbilities, eq(staffServiceAbilities.staffMemberId, staffMembers.id))
      .where(
        and(
          eq(staffServiceAbilities.tenantId, this.tenantId),
          eq(staffServiceAbilities.serviceId, serviceId),
          eq(staffMembers.isActive, true)
        )
      );
    return rows.map(r => r.staffMembers);
  }

  async setStaffServiceAbilities(staffMemberId: number, serviceIds: number[]): Promise<void> {
    await db.delete(staffServiceAbilities).where(and(eq(staffServiceAbilities.tenantId, this.tenantId), eq(staffServiceAbilities.staffMemberId, staffMemberId)));
    if (serviceIds.length > 0) {
      await db.insert(staffServiceAbilities).values(
        serviceIds.map(serviceId => ({ tenantId: this.tenantId, staffMemberId, serviceId }))
      );
    }
  }

  // ─── Staff Availability ────────────────────────────────────────────────────

  async getStaffAvailability(staffMemberId: number): Promise<StaffAvailability[]> {
    return await db.select().from(staffAvailability)
      .where(and(eq(staffAvailability.tenantId, this.tenantId), eq(staffAvailability.staffMemberId, staffMemberId)))
      .orderBy(asc(staffAvailability.dayOfWeek));
  }

  async setStaffAvailability(
    staffMemberId: number,
    availability: Omit<InsertStaffAvailability, 'staffMemberId'>[]
  ): Promise<StaffAvailability[]> {
    await db.delete(staffAvailability).where(and(eq(staffAvailability.tenantId, this.tenantId), eq(staffAvailability.staffMemberId, staffMemberId)));
    if (availability.length === 0) return [];
    return await db.insert(staffAvailability)
      .values(availability.map(a => ({ ...a, tenantId: this.tenantId, staffMemberId })))
      .returning();
  }

  // ─── Staff Availability Overrides ──────────────────────────────────────────

  async getStaffAvailabilityOverrides(staffMemberId: number): Promise<StaffAvailabilityOverride[]> {
    return await db.select().from(staffAvailabilityOverrides)
      .where(and(eq(staffAvailabilityOverrides.tenantId, this.tenantId), eq(staffAvailabilityOverrides.staffMemberId, staffMemberId)))
      .orderBy(asc(staffAvailabilityOverrides.date));
  }

  async getStaffAvailabilityOverridesByDate(staffMemberId: number, date: string): Promise<StaffAvailabilityOverride | undefined> {
    const rows = await db.select().from(staffAvailabilityOverrides)
      .where(and(
        eq(staffAvailabilityOverrides.tenantId, this.tenantId),
        eq(staffAvailabilityOverrides.staffMemberId, staffMemberId),
        eq(staffAvailabilityOverrides.date, date)
      ))
      .limit(1);
    return rows[0];
  }

  async createStaffAvailabilityOverride(data: InsertStaffAvailabilityOverride): Promise<StaffAvailabilityOverride> {
    const rows = await db.insert(staffAvailabilityOverrides).values({ ...data, tenantId: this.tenantId }).returning();
    return rows[0];
  }

  async deleteStaffAvailabilityOverride(id: number): Promise<void> {
    await db.delete(staffAvailabilityOverrides).where(and(eq(staffAvailabilityOverrides.tenantId, this.tenantId), eq(staffAvailabilityOverrides.id, id)));
  }

  // ─── Staff Google Calendar ─────────────────────────────────────────────────

  async getStaffGoogleCalendar(staffMemberId: number): Promise<StaffGoogleCalendar | undefined> {
    const [row] = await db.select().from(staffGoogleCalendar)
      .where(and(eq(staffGoogleCalendar.tenantId, this.tenantId), eq(staffGoogleCalendar.staffMemberId, staffMemberId)));
    return row;
  }

  async upsertStaffGoogleCalendar(calendar: InsertStaffGoogleCalendar): Promise<StaffGoogleCalendar> {
    const [row] = await db.insert(staffGoogleCalendar)
      .values({ ...calendar, tenantId: this.tenantId })
      .onConflictDoUpdate({
        target: staffGoogleCalendar.staffMemberId,
        set: {
          accessToken: calendar.accessToken,
          refreshToken: calendar.refreshToken,
          calendarId: calendar.calendarId,
          tokenExpiresAt: calendar.tokenExpiresAt,
        },
      })
      .returning();
    return row;
  }

  async deleteStaffGoogleCalendar(staffMemberId: number): Promise<void> {
    await db.delete(staffGoogleCalendar).where(and(eq(staffGoogleCalendar.tenantId, this.tenantId), eq(staffGoogleCalendar.staffMemberId, staffMemberId)));
  }

  async markCalendarNeedsReconnect(staffMemberId: number): Promise<void> {
    await db.update(staffGoogleCalendar)
      .set({ needsReconnect: true, lastDisconnectedAt: new Date() })
      .where(
        and(
          eq(staffGoogleCalendar.tenantId, this.tenantId),
          eq(staffGoogleCalendar.staffMemberId, staffMemberId),
          eq(staffGoogleCalendar.needsReconnect, false)
        )
      );
  }

  async clearCalendarNeedsReconnect(staffMemberId: number): Promise<void> {
    await db.update(staffGoogleCalendar)
      .set({ needsReconnect: false })
      .where(and(eq(staffGoogleCalendar.tenantId, this.tenantId), eq(staffGoogleCalendar.staffMemberId, staffMemberId)));
  }

  async getAllCalendarStatuses(): Promise<Array<{
    staffMemberId: number;
    firstName: string;
    lastName: string;
    connected: boolean;
    needsReconnect: boolean;
    lastDisconnectedAt: Date | null;
  }>> {
    const rows = await db
      .select({
        staffMemberId: staffMembers.id,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        calendarId: staffGoogleCalendar.id,
        needsReconnect: staffGoogleCalendar.needsReconnect,
        lastDisconnectedAt: staffGoogleCalendar.lastDisconnectedAt,
      })
      .from(staffMembers)
      .leftJoin(staffGoogleCalendar, eq(staffGoogleCalendar.staffMemberId, staffMembers.id))
      .where(and(eq(staffMembers.tenantId, this.tenantId), eq(staffMembers.isActive, true)));

    return rows.map((row) => ({
      staffMemberId: row.staffMemberId,
      firstName: row.firstName,
      lastName: row.lastName,
      connected: row.calendarId !== null && row.needsReconnect !== true,
      needsReconnect: row.needsReconnect ?? false,
      lastDisconnectedAt: row.lastDisconnectedAt ?? null,
    }));
  }

  // ─── Notification Logs ─────────────────────────────────────────────────────

  async createNotificationLog(entry: InsertNotificationLog): Promise<NotificationLog> {
    const [row] = await db.insert(notificationLogs).values({ ...entry, tenantId: this.tenantId }).returning();
    return row;
  }

  async getNotificationLogsByConversation(conversationId: string): Promise<NotificationLog[]> {
    return db
      .select()
      .from(notificationLogs)
      .where(and(eq(notificationLogs.tenantId, this.tenantId), eq(notificationLogs.conversationId, conversationId)))
      .orderBy(desc(notificationLogs.sentAt));
  }

  async getNotificationLogsByBooking(bookingId: number): Promise<NotificationLog[]> {
    return db
      .select()
      .from(notificationLogs)
      .where(and(eq(notificationLogs.tenantId, this.tenantId), eq(notificationLogs.bookingId, bookingId)))
      .orderBy(desc(notificationLogs.sentAt));
  }

  async getNotificationLogs(filters: {
    channel?: string;
    status?: string;
    trigger?: string;
    search?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<NotificationLog[]> {
    const conditions: any[] = [eq(notificationLogs.tenantId, this.tenantId)];
    if (filters.channel) conditions.push(eq(notificationLogs.channel, filters.channel));
    if (filters.status) conditions.push(eq(notificationLogs.status, filters.status));
    if (filters.trigger) conditions.push(eq(notificationLogs.trigger, filters.trigger));
    if (filters.search) conditions.push(like(notificationLogs.recipient, `%${filters.search}%`));
    if (filters.from) conditions.push(gte(notificationLogs.sentAt, filters.from));
    if (filters.to) conditions.push(lte(notificationLogs.sentAt, filters.to));

    return db
      .select()
      .from(notificationLogs)
      .where(and(...conditions))
      .orderBy(desc(notificationLogs.sentAt))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts)
      .where(and(eq(contacts.tenantId, this.tenantId), eq(contacts.id, id)));
    return contact;
  }

  async listContactsWithStats(search?: string, limit = 100): Promise<Contact[]> {
    if (search) {
      return db.select().from(contacts)
        .where(and(
          eq(contacts.tenantId, this.tenantId),
          or(like(contacts.name, `%${search}%`), like(contacts.email ?? '', `%${search}%`), like(contacts.phone ?? '', `%${search}%`))
        ))
        .limit(limit)
        .orderBy(desc(contacts.updatedAt));
    }
    return db.select().from(contacts)
      .where(eq(contacts.tenantId, this.tenantId))
      .limit(limit)
      .orderBy(desc(contacts.updatedAt));
  }

  async upsertContact(data: Omit<InsertContact, 'updatedAt'>): Promise<Contact> {
    if (data.email) {
      const [existing] = await db.select().from(contacts)
        .where(and(eq(contacts.tenantId, this.tenantId), eq(contacts.email, data.email)));
      if (existing) {
        const [updated] = await db.update(contacts)
          .set({ ...data, updatedAt: new Date() })
          .where(and(eq(contacts.tenantId, this.tenantId), eq(contacts.id, existing.id)))
          .returning();
        return updated;
      }
    }
    const [created] = await db.insert(contacts).values({ ...data, tenantId: this.tenantId, updatedAt: new Date() }).returning();
    return created;
  }

  async updateContact(id: number, data: Partial<InsertContact>): Promise<Contact> {
    const [updated] = await db.update(contacts).set({ ...data, updatedAt: new Date() })
      .where(and(eq(contacts.tenantId, this.tenantId), eq(contacts.id, id)))
      .returning();
    return updated;
  }

  async updateBookingContactId(bookingId: number, contactId: number): Promise<void> {
    await db.update(bookings).set({ contactId }).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.id, bookingId)));
  }

  async getContactBookings(contactId: number): Promise<Booking[]> {
    return db.select().from(bookings).where(and(eq(bookings.tenantId, this.tenantId), eq(bookings.contactId, contactId))).orderBy(desc(bookings.createdAt));
  }

  async getBookingsByDateRange(from: string, to: string): Promise<Booking[]> {
    return db.select().from(bookings).where(and(eq(bookings.tenantId, this.tenantId), gte(bookings.bookingDate, from), lte(bookings.bookingDate, to))).orderBy(asc(bookings.bookingDate));
  }

  // === Recurring Bookings (Phase 27 RECUR-01) ===

  async createRecurringBooking(data: InsertRecurringBooking): Promise<RecurringBooking> {
    const validated = insertRecurringBookingSchema.parse(data);
    const [row] = await db.insert(recurringBookings).values({ ...validated, tenantId: this.tenantId }).returning();
    return row;
  }

  async getRecurringBooking(id: number): Promise<RecurringBooking | undefined> {
    const [row] = await db
      .select()
      .from(recurringBookings)
      .where(and(eq(recurringBookings.tenantId, this.tenantId), eq(recurringBookings.id, id)))
      .limit(1);
    return row;
  }

  async getRecurringBookings(statusFilter?: string): Promise<RecurringBooking[]> {
    if (statusFilter) {
      return db
        .select()
        .from(recurringBookings)
        .where(and(eq(recurringBookings.tenantId, this.tenantId), eq(recurringBookings.status, statusFilter)))
        .orderBy(desc(recurringBookings.createdAt));
    }
    return db.select().from(recurringBookings)
      .where(eq(recurringBookings.tenantId, this.tenantId))
      .orderBy(desc(recurringBookings.createdAt));
  }

  async getActiveRecurringBookingsDueForGeneration(asOfDate: string): Promise<RecurringBooking[]> {
    return db
      .select()
      .from(recurringBookings)
      .where(
        and(
          eq(recurringBookings.tenantId, this.tenantId),
          eq(recurringBookings.status, "active"),
          lte(recurringBookings.nextBookingDate, asOfDate),
          or(
            isNull(recurringBookings.endDate),
            // endDate > nextBookingDate prevents generating into the expired window
            sql`${recurringBookings.endDate} > ${recurringBookings.nextBookingDate}`
          )
        )
      );
  }

  async updateRecurringBooking(
    id: number,
    data: Partial<Pick<RecurringBooking, 'status' | 'nextBookingDate' | 'cancelledAt' | 'pausedAt' | 'updatedAt'>>
  ): Promise<RecurringBooking> {
    const [row] = await db
      .update(recurringBookings)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(recurringBookings.tenantId, this.tenantId), eq(recurringBookings.id, id)))
      .returning();
    return row;
  }

  async getRecurringBookingByToken(token: string): Promise<RecurringBooking | undefined> {
    const [row] = await db
      .select()
      .from(recurringBookings)
      .where(and(eq(recurringBookings.tenantId, this.tenantId), eq(recurringBookings.manageToken, token)));
    return row;
  }

  async getRecurringBookingsWithDetails(): Promise<RecurringBookingWithDetails[]> {
    const rows = await db
      .select({
        id: recurringBookings.id,
        tenantId: recurringBookings.tenantId,
        contactId: recurringBookings.contactId,
        serviceId: recurringBookings.serviceId,
        serviceFrequencyId: recurringBookings.serviceFrequencyId,
        discountPercent: recurringBookings.discountPercent,
        intervalDays: recurringBookings.intervalDays,
        frequencyName: recurringBookings.frequencyName,
        startDate: recurringBookings.startDate,
        endDate: recurringBookings.endDate,
        nextBookingDate: recurringBookings.nextBookingDate,
        preferredStartTime: recurringBookings.preferredStartTime,
        preferredStaffMemberId: recurringBookings.preferredStaffMemberId,
        status: recurringBookings.status,
        cancelledAt: recurringBookings.cancelledAt,
        pausedAt: recurringBookings.pausedAt,
        originBookingId: recurringBookings.originBookingId,
        manageToken: recurringBookings.manageToken,
        durationMinutes: recurringBookings.durationMinutes, // Phase 30 DUR-06: snapshot of chosen duration
        createdAt: recurringBookings.createdAt,
        updatedAt: recurringBookings.updatedAt,
        contactName: contacts.name,
        serviceName: services.name,
        customerEmail: contacts.email,
      })
      .from(recurringBookings)
      .leftJoin(contacts, eq(recurringBookings.contactId, contacts.id))
      .leftJoin(services, eq(recurringBookings.serviceId, services.id))
      .where(eq(recurringBookings.tenantId, this.tenantId))
      .orderBy(desc(recurringBookings.createdAt));
    return rows.map((r) => ({
      ...r,
      contactName: r.contactName ?? null,
      serviceName: r.serviceName ?? "Unknown Service",
      customerEmail: r.customerEmail ?? null,
    }));
  }

  // === Calendar Sync Queue (Phase 32) ===

  async enqueueCalendarSync(bookingId: number, target: string, operation: string, payload?: object): Promise<void> {
    await db.insert(calendarSyncQueue).values({
      tenantId: this.tenantId,
      bookingId,
      target,
      operation,
      payload: payload ?? null,
      status: 'pending',
    });
  }

  async getCalendarSyncHealth(): Promise<CalendarSyncHealth[]> {
    const targets = ['ghl_contact', 'ghl_appointment', 'google_calendar'];
    const health: CalendarSyncHealth[] = [];

    for (const target of targets) {
      // Pending count
      const pendingResult = await db.execute(sql`
        SELECT COUNT(*)::int AS count
        FROM calendar_sync_queue
        WHERE target = ${target} AND status = 'pending'
          AND tenant_id = ${this.tenantId}
      `);
      const pendingCount = (pendingResult[0] as any)?.count ?? 0;

      // Failed permanent count (last 24h for SYNC-06 banner signal)
      const failedResult = await db.execute(sql`
        SELECT COUNT(*)::int AS count
        FROM calendar_sync_queue
        WHERE target = ${target}
          AND status = 'failed_permanent'
          AND created_at > NOW() - INTERVAL '24 hours'
          AND tenant_id = ${this.tenantId}
      `);
      const failedPermanentCount = (failedResult[0] as any)?.count ?? 0;

      // Recent failures (last 20 for admin table)
      const failures = await db.execute(sql`
        SELECT id, booking_id AS "bookingId", last_error AS "lastError",
               last_attempt_at AS "lastAttemptAt", attempts
        FROM calendar_sync_queue
        WHERE target = ${target} AND status = 'failed_permanent'
          AND tenant_id = ${this.tenantId}
        ORDER BY last_attempt_at DESC NULLS LAST
        LIMIT 20
      `);

      health.push({
        target,
        pendingCount,
        failedPermanentCount,
        recentFailures: Array.from(failures) as CalendarSyncHealth['recentFailures'],
      });
    }

    return health;
  }

  async retryCalendarSyncJob(jobId: number): Promise<void> {
    await db.execute(sql`
      UPDATE calendar_sync_queue
      SET status = 'pending',
          scheduled_for = NOW(),
          last_error = NULL
      WHERE id = ${jobId}
        AND status IN ('failed_permanent', 'failed_retryable')
        AND tenant_id = ${this.tenantId}
    `);
  }

  async listRecentSyncFailures(target?: string, limit = 50): Promise<CalendarSyncJob[]> {
    if (target) {
      const rows = await db.execute(sql`
        SELECT * FROM calendar_sync_queue
        WHERE target = ${target} AND status = 'failed_permanent'
          AND tenant_id = ${this.tenantId}
        ORDER BY last_attempt_at DESC NULLS LAST
        LIMIT ${limit}
      `);
      return Array.from(rows) as CalendarSyncJob[];
    }
    const rows = await db.execute(sql`
      SELECT * FROM calendar_sync_queue
      WHERE status = 'failed_permanent'
        AND tenant_id = ${this.tenantId}
      ORDER BY last_attempt_at DESC NULLS LAST
      LIMIT ${limit}
    `);
    return Array.from(rows) as CalendarSyncJob[];
  }
}

export const storage = DatabaseStorage.forTenant(1);
