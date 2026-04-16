import { db } from "../db";
import {
  integrationSettings,
  type IntegrationSettings, type InsertIntegrationSettings,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getIntegrationSettings(provider: string): Promise<IntegrationSettings | undefined> {
  const [settings] = await db.select().from(integrationSettings)
    .where(eq(integrationSettings.provider, provider));
  return settings;
}

export async function upsertIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings> {
  const provider = settings.provider || "gohighlevel";
  console.log(`Storage: upsertIntegrationSettings for provider: ${provider}`);
  const existing = await getIntegrationSettings(provider);
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
