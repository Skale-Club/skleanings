import { db } from "../db";
import {
  companySettings, faqs, serviceAreas, serviceAreaGroups, serviceAreaCities,
  type CompanySettings, type Faq, type ServiceArea, type ServiceAreaGroup, type ServiceAreaCity,
  type InsertCompanySettings, type InsertFaq,
  type InsertServiceArea, type InsertServiceAreaGroup, type InsertServiceAreaCity,
  type BusinessHours, DEFAULT_BUSINESS_HOURS,
} from "@shared/schema";
import { eq } from "drizzle-orm";

// ─── Company Settings ─────────────────────────────────────────────────────────

export async function getCompanySettings(): Promise<CompanySettings> {
  const [settings] = await db.select().from(companySettings);
  if (settings) return settings;
  const [newSettings] = await db.insert(companySettings).values({}).returning();
  return newSettings;
}

export async function updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings> {
  const existing = await getCompanySettings();
  const [updated] = await db.update(companySettings)
    .set(settings)
    .where(eq(companySettings.id, existing.id))
    .returning();
  return updated;
}

export async function getBusinessHours(): Promise<BusinessHours> {
  const settings = await getCompanySettings();
  if (settings?.businessHours) return settings.businessHours as BusinessHours;
  return DEFAULT_BUSINESS_HOURS;
}

// ─── FAQs ─────────────────────────────────────────────────────────────────────

export async function getFaqs(includeInactive: boolean = false): Promise<Faq[]> {
  if (includeInactive) return await db.select().from(faqs).orderBy(faqs.order);
  return await db.select().from(faqs).where(eq(faqs.isActive, true)).orderBy(faqs.order);
}

export async function createFaq(faq: InsertFaq): Promise<Faq> {
  const [newFaq] = await db.insert(faqs).values(faq).returning();
  return newFaq;
}

export async function updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq> {
  const [updated] = await db.update(faqs).set(faq).where(eq(faqs.id, id)).returning();
  return updated;
}

export async function deleteFaq(id: number): Promise<void> {
  await db.delete(faqs).where(eq(faqs.id, id));
}

// ─── Service Areas (legacy) ───────────────────────────────────────────────────

export async function getServiceAreas(includeInactive: boolean = false): Promise<ServiceArea[]> {
  if (includeInactive) return await db.select().from(serviceAreas).orderBy(serviceAreas.order);
  return await db.select().from(serviceAreas).where(eq(serviceAreas.isActive, true)).orderBy(serviceAreas.order);
}

export async function createServiceArea(area: InsertServiceArea): Promise<ServiceArea> {
  const [newArea] = await db.insert(serviceAreas).values(area).returning();
  return newArea;
}

export async function updateServiceArea(id: number, area: Partial<InsertServiceArea>): Promise<ServiceArea> {
  const [updated] = await db.update(serviceAreas).set(area).where(eq(serviceAreas.id, id)).returning();
  if (!updated) throw new Error('Service area not found');
  return updated;
}

export async function deleteServiceArea(id: number): Promise<void> {
  await db.delete(serviceAreas).where(eq(serviceAreas.id, id));
}

export async function reorderServiceAreas(updates: { id: number; order: number }[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const update of updates) {
      await tx.update(serviceAreas).set({ order: update.order }).where(eq(serviceAreas.id, update.id));
    }
  });
}

// ─── Service Area Groups ──────────────────────────────────────────────────────

export async function getServiceAreaGroups(includeInactive: boolean = false): Promise<ServiceAreaGroup[]> {
  if (includeInactive) return await db.select().from(serviceAreaGroups).orderBy(serviceAreaGroups.order);
  return await db.select().from(serviceAreaGroups)
    .where(eq(serviceAreaGroups.isActive, true))
    .orderBy(serviceAreaGroups.order);
}

export async function createServiceAreaGroup(group: InsertServiceAreaGroup): Promise<ServiceAreaGroup> {
  const [newGroup] = await db.insert(serviceAreaGroups).values(group).returning();
  return newGroup;
}

export async function updateServiceAreaGroup(id: number, group: Partial<InsertServiceAreaGroup>): Promise<ServiceAreaGroup> {
  const [updated] = await db.update(serviceAreaGroups).set(group).where(eq(serviceAreaGroups.id, id)).returning();
  if (!updated) throw new Error('Service area group not found');
  return updated;
}

export async function deleteServiceAreaGroup(id: number): Promise<void> {
  const cities = await db.select().from(serviceAreaCities).where(eq(serviceAreaCities.areaGroupId, id));
  if (cities.length > 0) {
    throw new Error(`Cannot delete area group with ${cities.length} cities. Delete or reassign cities first.`);
  }
  await db.delete(serviceAreaGroups).where(eq(serviceAreaGroups.id, id));
}

export async function reorderServiceAreaGroups(updates: { id: number; order: number }[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const update of updates) {
      await tx.update(serviceAreaGroups).set({ order: update.order }).where(eq(serviceAreaGroups.id, update.id));
    }
  });
}

// ─── Service Area Cities ──────────────────────────────────────────────────────

export async function getServiceAreaCities(groupId?: number, includeInactive: boolean = false): Promise<ServiceAreaCity[]> {
  const conditions: any[] = [];
  if (groupId) conditions.push(eq(serviceAreaCities.areaGroupId, groupId));
  if (!includeInactive) conditions.push(eq(serviceAreaCities.isActive, true));

  let query = db.select().from(serviceAreaCities);
  if (conditions.length > 0) query = query.where(conditions.length === 1 ? conditions[0] : conditions.reduce((a, b) => a && b)) as any;
  return await query.orderBy(serviceAreaCities.order);
}

export async function createServiceAreaCity(city: InsertServiceAreaCity): Promise<ServiceAreaCity> {
  const [newCity] = await db.insert(serviceAreaCities).values(city).returning();
  return newCity;
}

export async function updateServiceAreaCity(id: number, city: Partial<InsertServiceAreaCity>): Promise<ServiceAreaCity> {
  const [updated] = await db.update(serviceAreaCities).set(city).where(eq(serviceAreaCities.id, id)).returning();
  if (!updated) throw new Error('Service area city not found');
  return updated;
}

export async function deleteServiceAreaCity(id: number): Promise<void> {
  await db.delete(serviceAreaCities).where(eq(serviceAreaCities.id, id));
}

export async function reorderServiceAreaCities(updates: { id: number; order: number }[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const update of updates) {
      await tx.update(serviceAreaCities).set({ order: update.order }).where(eq(serviceAreaCities.id, update.id));
    }
  });
}
