import { db } from "../db";
import {
  categories, subcategories, services, serviceAddons, serviceOptions, serviceFrequencies,
  blogPostServices,
  type Category, type Subcategory, type Service, type ServiceAddon,
  type ServiceOption, type ServiceFrequency,
  type InsertCategory, type InsertService, type InsertServiceAddon,
  type InsertServiceOption, type InsertServiceFrequency,
} from "@shared/schema";
import { eq, and, inArray, asc, sql } from "drizzle-orm";
import { z } from "zod";

export const insertSubcategorySchema = z.object({
  categoryId: z.number(),
  name: z.string().min(1),
  slug: z.string().min(1),
});
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  return await db.select().from(categories).orderBy(categories.order);
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
  return category;
}

export async function createCategory(category: InsertCategory): Promise<Category> {
  const [newCategory] = await db.insert(categories).values(category).returning();
  return newCategory;
}

export async function updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
  const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
  return updated;
}

export async function deleteCategory(id: number): Promise<void> {
  await db.delete(categories).where(eq(categories.id, id));
}

// ─── Subcategories ────────────────────────────────────────────────────────────

export async function getSubcategories(categoryId?: number): Promise<Subcategory[]> {
  if (categoryId) {
    return await db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId));
  }
  return await db.select().from(subcategories);
}

export async function createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory> {
  const [newSubcategory] = await db.insert(subcategories).values(subcategory).returning();
  return newSubcategory;
}

export async function updateSubcategory(id: number, subcategory: Partial<InsertSubcategory>): Promise<Subcategory> {
  const [updated] = await db.update(subcategories).set(subcategory).where(eq(subcategories.id, id)).returning();
  return updated;
}

export async function deleteSubcategory(id: number): Promise<void> {
  await db.delete(subcategories).where(eq(subcategories.id, id));
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getServices(
  categoryId?: number,
  subcategoryId?: number,
  includeHidden: boolean = false,
  showOnLanding?: boolean,
): Promise<Service[]> {
  const baseConditions = [eq(services.isArchived, false)];
  if (!includeHidden) baseConditions.push(eq(services.isHidden, false));
  if (showOnLanding !== undefined) baseConditions.push(eq(services.showOnLanding, showOnLanding));

  if (subcategoryId) {
    return await db.select().from(services)
      .where(and(...baseConditions, eq(services.subcategoryId, subcategoryId)))
      .orderBy(asc(services.order), asc(services.id));
  }
  if (categoryId) {
    return await db.select().from(services)
      .where(and(...baseConditions, eq(services.categoryId, categoryId)))
      .orderBy(asc(services.order), asc(services.id));
  }
  return await db.select().from(services)
    .where(and(...baseConditions))
    .orderBy(asc(services.order), asc(services.id));
}

export async function getService(id: number): Promise<Service | undefined> {
  const [service] = await db.select().from(services)
    .where(and(eq(services.id, id), eq(services.isArchived, false)));
  return service;
}

export async function createService(service: InsertService): Promise<Service> {
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

export async function updateService(id: number, service: Partial<InsertService>): Promise<Service> {
  const [updated] = await db.update(services).set(service).where(eq(services.id, id)).returning();
  return updated;
}

export async function deleteService(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(serviceAddons).where(eq(serviceAddons.serviceId, id));
    await tx.delete(serviceAddons).where(eq(serviceAddons.addonServiceId, id));
    await tx.delete(serviceOptions).where(eq(serviceOptions.serviceId, id));
    await tx.delete(serviceFrequencies).where(eq(serviceFrequencies.serviceId, id));
    await tx.delete(blogPostServices).where(eq(blogPostServices.serviceId, id));
    await tx.update(services).set({ isArchived: true }).where(eq(services.id, id));
  });
}

export async function reorderServices(order: { id: number; order: number }[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const item of order) {
      await tx.update(services).set({ order: item.order }).where(eq(services.id, item.id));
    }
  });
}

// ─── Service Addons ───────────────────────────────────────────────────────────

export async function getServiceAddons(serviceId: number): Promise<Service[]> {
  const addonRelations = await db.select().from(serviceAddons).where(eq(serviceAddons.serviceId, serviceId));
  if (addonRelations.length === 0) return [];
  const addonIds = addonRelations.map(r => r.addonServiceId);
  return await db.select().from(services)
    .where(and(inArray(services.id, addonIds), eq(services.isArchived, false)));
}

export async function setServiceAddons(serviceId: number, addonServiceIds: number[]): Promise<void> {
  await db.delete(serviceAddons).where(eq(serviceAddons.serviceId, serviceId));
  if (addonServiceIds.length > 0) {
    await db.insert(serviceAddons).values(addonServiceIds.map(addonId => ({ serviceId, addonServiceId: addonId })));
  }
}

export async function getAddonRelationships(): Promise<ServiceAddon[]> {
  return await db.select().from(serviceAddons);
}

// ─── Service Options ──────────────────────────────────────────────────────────

export async function getServiceOptions(serviceId: number): Promise<ServiceOption[]> {
  return await db.select().from(serviceOptions)
    .where(eq(serviceOptions.serviceId, serviceId))
    .orderBy(asc(serviceOptions.order), asc(serviceOptions.id));
}

export async function createServiceOption(option: InsertServiceOption): Promise<ServiceOption> {
  const [newOption] = await db.insert(serviceOptions).values(option).returning();
  return newOption;
}

export async function updateServiceOption(id: number, option: Partial<InsertServiceOption>): Promise<ServiceOption> {
  const [updated] = await db.update(serviceOptions).set(option).where(eq(serviceOptions.id, id)).returning();
  return updated;
}

export async function deleteServiceOption(id: number): Promise<void> {
  await db.delete(serviceOptions).where(eq(serviceOptions.id, id));
}

export async function setServiceOptions(
  serviceId: number,
  options: Omit<InsertServiceOption, 'serviceId'>[],
): Promise<ServiceOption[]> {
  await db.delete(serviceOptions).where(eq(serviceOptions.serviceId, serviceId));
  if (options.length === 0) return [];
  return await db.insert(serviceOptions)
    .values(options.map((opt, index) => ({ ...opt, serviceId, order: opt.order ?? index })))
    .returning();
}

// ─── Service Frequencies ──────────────────────────────────────────────────────

export async function getServiceFrequencies(serviceId: number): Promise<ServiceFrequency[]> {
  return await db.select().from(serviceFrequencies)
    .where(eq(serviceFrequencies.serviceId, serviceId))
    .orderBy(asc(serviceFrequencies.order), asc(serviceFrequencies.id));
}

export async function createServiceFrequency(frequency: InsertServiceFrequency): Promise<ServiceFrequency> {
  const [newFrequency] = await db.insert(serviceFrequencies).values(frequency).returning();
  return newFrequency;
}

export async function updateServiceFrequency(id: number, frequency: Partial<InsertServiceFrequency>): Promise<ServiceFrequency> {
  const [updated] = await db.update(serviceFrequencies).set(frequency).where(eq(serviceFrequencies.id, id)).returning();
  return updated;
}

export async function deleteServiceFrequency(id: number): Promise<void> {
  await db.delete(serviceFrequencies).where(eq(serviceFrequencies.id, id));
}

export async function setServiceFrequencies(
  serviceId: number,
  frequencies: Omit<InsertServiceFrequency, 'serviceId'>[],
): Promise<ServiceFrequency[]> {
  await db.delete(serviceFrequencies).where(eq(serviceFrequencies.serviceId, serviceId));
  if (frequencies.length === 0) return [];
  return await db.insert(serviceFrequencies)
    .values(frequencies.map((freq, index) => ({ ...freq, serviceId, order: freq.order ?? index })))
    .returning();
}
