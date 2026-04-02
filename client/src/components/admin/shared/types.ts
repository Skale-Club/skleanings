import type { HomepageContent } from '@shared/schema';

export type AdminSection =
  | 'dashboard'
  | 'categories'
  | 'services'
  | 'bookings'
  | 'hero'
  | 'company'
  | 'seo'
  | 'faqs'
  | 'users'
  | 'availability'
  | 'chat'
  | 'integrations'
  | 'blog';

export interface DayHours {
  isOpen: boolean;
  start: string;
  end: string;
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

export interface CompanySettingsData {
  id?: number;
  companyName: string | null;
  industry: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  logoMain: string | null;
  logoDark: string | null;
  logoIcon: string | null;
  sectionsOrder: AdminSection[] | null;
  socialLinks: { platform: string; url: string }[] | null;
  mapEmbedUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  ctaText: string | null;
  homepageContent: HomepageContent | null;
  timeFormat: string | null;
  timeZone: string | null;
  businessHours: BusinessHours | null;
  minimumBookingValue: string | null;
}

export interface SEOSettingsData {
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  seoKeywords: string | null;
  seoAuthor: string | null;
  seoCanonicalUrl: string | null;
  seoRobotsTag: string | null;
  ogType: string | null;
  ogSiteName: string | null;
  twitterCard: string | null;
  twitterSite: string | null;
  twitterCreator: string | null;
  schemaLocalBusiness: Record<string, any> | null;
}

export interface GHLSettings {
  provider: string;
  apiKey: string;
  locationId: string;
  calendarId: string;
  isEnabled: boolean;
}

export interface OpenAISettings {
  provider: string;
  enabled: boolean;
  model: string;
  hasKey: boolean;
}

export interface GeminiSettings {
  provider: 'gemini';
  enabled: boolean;
  model: string;
  hasKey: boolean;
}

export interface OpenRouterSettings {
  provider: 'openrouter';
  enabled: boolean;
  model: string;
  hasKey: boolean;
}

export interface AnalyticsSettings {
  gtmContainerId: string;
  ga4MeasurementId: string;
  facebookPixelId: string;
  gtmEnabled: boolean;
  ga4Enabled: boolean;
  facebookPixelEnabled: boolean;
}

export interface TwilioSettingsForm {
  enabled: boolean;
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
  toPhoneNumbers: string[];
  notifyOnNewChat: boolean;
}

export interface TelegramSettingsForm {
  enabled: boolean;
  botToken: string;
  chatIds: string[];
  notifyOnNewChat: boolean;
}

export type { UrlRule, IntakeObjective, ChatSettingsData, ConversationSummary, ConversationMessage } from '@/components/chat/admin/types';
