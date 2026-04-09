/**
 * Storage layer entry point.
 * Implementation is split across server/storage/ domain files.
 * This file re-exports everything so existing imports remain unchanged.
 */
export { storage, insertSubcategorySchema } from "./storage/index";
export type { InsertSubcategory } from "./storage/index";

import type {
  User, UpsertUser, UserRole,
  Category, Subcategory, Service, ServiceAddon, ServiceOption, ServiceFrequency,
  Booking, BookingItem, CompanySettings, ChatSettings, ChatIntegrations,
  TwilioSettings, TelegramSettings, Conversation, ConversationMessage,
  Faq, ServiceArea, ServiceAreaGroup, ServiceAreaCity, IntegrationSettings,
  BlogPost, BlogSettings,
  InsertCategory, InsertService, InsertServiceOption, InsertServiceFrequency, InsertBooking,
  InsertChatSettings, InsertChatIntegrations, InsertTwilioSettings, InsertTelegramSettings,
  InsertConversation, InsertConversationMessage, InsertFaq, InsertServiceArea,
  InsertServiceAreaGroup, InsertServiceAreaCity, InsertIntegrationSettings, InsertBlogPost,
  InsertBlogSettings, BusinessHours, InsertCompanySettings,
  BlogGenerationJob, InsertBlogGenerationJob,
  StaffMember, StaffAvailability, StaffGoogleCalendar,
  InsertStaffMember, InsertStaffAvailability, InsertStaffGoogleCalendar,
  Contact,
} from "@shared/schema";
import type { InsertSubcategory } from "./storage/index";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserRole(userId: string, role: UserRole): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  linkStaffToUser(staffMemberId: number, userId: string): Promise<void>;

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

  // Service Options
  getServiceOptions(serviceId: number): Promise<ServiceOption[]>;
  createServiceOption(option: InsertServiceOption): Promise<ServiceOption>;
  updateServiceOption(id: number, option: Partial<InsertServiceOption>): Promise<ServiceOption>;
  deleteServiceOption(id: number): Promise<void>;
  setServiceOptions(serviceId: number, options: Omit<InsertServiceOption, 'serviceId'>[]): Promise<ServiceOption[]>;

  // Service Frequencies
  getServiceFrequencies(serviceId: number): Promise<ServiceFrequency[]>;
  createServiceFrequency(frequency: InsertServiceFrequency): Promise<ServiceFrequency>;
  updateServiceFrequency(id: number, frequency: Partial<InsertServiceFrequency>): Promise<ServiceFrequency>;
  deleteServiceFrequency(id: number): Promise<void>;
  setServiceFrequencies(serviceId: number, frequencies: Omit<InsertServiceFrequency, 'serviceId'>[]): Promise<ServiceFrequency[]>;

  // Bookings
  createBooking(booking: InsertBooking & { totalPrice: string; totalDurationMinutes: number; endTime: string; bookingItemsData?: any[] }): Promise<Booking>;
  getBookings(limit?: number): Promise<Booking[]>;
  getBookingsByDate(date: string): Promise<Booking[]>;
  getBookingsByDateAndStaff(date: string, staffMemberId: number): Promise<Booking[]>;
  getBookingsByDateRange(from: string, to: string): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingByStripeSessionId(sessionId: string): Promise<Booking | undefined>;
  updateBookingStripeFields(bookingId: number, stripeSessionId: string, stripePaymentStatus?: string): Promise<void>;
  updateBooking(id: number, updates: Partial<{ customerName: string; customerEmail: string | null; customerPhone: string; customerAddress: string; bookingDate: string; startTime: string; endTime: string; status: string; paymentStatus: string; totalPrice: string }> & { bookingItems?: Array<{ serviceId: number; serviceName: string; price: string; quantity?: number }> }): Promise<Booking>;
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

  // Service Areas
  getServiceAreas(includeInactive?: boolean): Promise<ServiceArea[]>;
  createServiceArea(area: InsertServiceArea): Promise<ServiceArea>;
  updateServiceArea(id: number, area: Partial<InsertServiceArea>): Promise<ServiceArea>;
  deleteServiceArea(id: number): Promise<void>;
  reorderServiceAreas(updates: { id: number; order: number }[]): Promise<void>;
  getServiceAreaGroups(includeInactive?: boolean): Promise<ServiceAreaGroup[]>;
  createServiceAreaGroup(group: InsertServiceAreaGroup): Promise<ServiceAreaGroup>;
  updateServiceAreaGroup(id: number, group: Partial<InsertServiceAreaGroup>): Promise<ServiceAreaGroup>;
  deleteServiceAreaGroup(id: number): Promise<void>;
  reorderServiceAreaGroups(updates: { id: number; order: number }[]): Promise<void>;
  getServiceAreaCities(groupId?: number, includeInactive?: boolean): Promise<ServiceAreaCity[]>;
  createServiceAreaCity(city: InsertServiceAreaCity): Promise<ServiceAreaCity>;
  updateServiceAreaCity(id: number, city: Partial<InsertServiceAreaCity>): Promise<ServiceAreaCity>;
  deleteServiceAreaCity(id: number): Promise<void>;
  reorderServiceAreaCities(updates: { id: number; order: number }[]): Promise<void>;

  // Integration Settings
  getIntegrationSettings(provider: string): Promise<IntegrationSettings | undefined>;
  upsertIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings>;
  updateBookingGHLSync(bookingId: number, ghlContactId: string, ghlAppointmentId: string, syncStatus: string): Promise<void>;

  // Chat
  getChatSettings(): Promise<ChatSettings>;
  updateChatSettings(settings: Partial<InsertChatSettings>): Promise<ChatSettings>;
  getChatIntegration(provider: string): Promise<ChatIntegrations | undefined>;
  upsertChatIntegration(settings: InsertChatIntegrations): Promise<ChatIntegrations>;
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
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

  // Blog
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

  // Contacts
  upsertContact(data: { name: string; email?: string; phone?: string; address?: string; ghlContactId?: string }): Promise<Contact>;
  getContact(id: number): Promise<Contact | undefined>;
  getContactByEmailOrPhone(email?: string, phone?: string): Promise<Contact | undefined>;
  listContacts(search?: string, limit?: number): Promise<Contact[]>;
  listContactsWithStats(search?: string, limit?: number): Promise<(Contact & { bookingCount: number; totalSpend: number; lastBookingDate: string | null })[]>;
  getContactBookings(contactId: number): Promise<Booking[]>;
  updateContact(id: number, data: Partial<Pick<Contact, 'name' | 'email' | 'phone' | 'address' | 'notes'>>): Promise<Contact>;
  updateBookingContactId(bookingId: number, contactId: number): Promise<void>;

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
  getStaffMembersByService(serviceId: number): Promise<StaffMember[]>;
  getServicesByStaffMember(staffMemberId: number): Promise<Service[]>;
  getStaffMembersByServiceId(serviceId: number): Promise<StaffMember[]>;
  setStaffServiceAbilities(staffMemberId: number, serviceIds: number[]): Promise<void>;
  getStaffAvailability(staffMemberId: number): Promise<StaffAvailability[]>;
  setStaffAvailability(staffMemberId: number, availability: Omit<InsertStaffAvailability, 'staffMemberId'>[]): Promise<StaffAvailability[]>;
  getStaffGoogleCalendar(staffMemberId: number): Promise<StaffGoogleCalendar | undefined>;
  upsertStaffGoogleCalendar(calendar: InsertStaffGoogleCalendar): Promise<StaffGoogleCalendar>;
  deleteStaffGoogleCalendar(staffMemberId: number): Promise<void>;
  markCalendarNeedsReconnect(staffMemberId: number): Promise<void>;
  clearCalendarNeedsReconnect(staffMemberId: number): Promise<void>;
  getAllCalendarStatuses(): Promise<Array<{ staffMemberId: number; firstName: string; lastName: string; connected: boolean; needsReconnect: boolean; lastDisconnectedAt: Date | null }>>;
}
