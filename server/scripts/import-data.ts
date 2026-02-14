import { db } from '../db';
import * as schema from '@shared/schema';
import { sql } from 'drizzle-orm';
import fs from 'fs';

// Helper to convert ISO date strings back to Date objects
function convertDates(obj: Record<string, any>, dateFields: string[]): Record<string, any> {
  const result = { ...obj };
  for (const field of dateFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = new Date(result[field]);
    }
  }
  return result;
}

async function importData() {
  console.log('Importing data to Supabase...');

  const data = JSON.parse(fs.readFileSync('data-export.json', 'utf-8'));

  // Clear existing data in reverse order (respecting foreign keys)
  console.log('\n🗑️  Clearing existing data...');
  await db.execute(sql`TRUNCATE TABLE twilio_settings CASCADE`);
  await db.execute(sql`TRUNCATE TABLE chat_integrations CASCADE`);
  await db.execute(sql`TRUNCATE TABLE chat_settings CASCADE`);
  await db.execute(sql`TRUNCATE TABLE conversation_messages CASCADE`);
  await db.execute(sql`TRUNCATE TABLE conversations CASCADE`);
  await db.execute(sql`TRUNCATE TABLE blog_post_services CASCADE`);
  await db.execute(sql`TRUNCATE TABLE blog_posts CASCADE`);
  await db.execute(sql`TRUNCATE TABLE faqs CASCADE`);
  await db.execute(sql`TRUNCATE TABLE integration_settings CASCADE`);
  await db.execute(sql`TRUNCATE TABLE company_settings CASCADE`);
  await db.execute(sql`TRUNCATE TABLE booking_items CASCADE`);
  await db.execute(sql`TRUNCATE TABLE bookings CASCADE`);
  await db.execute(sql`TRUNCATE TABLE service_frequencies CASCADE`);
  await db.execute(sql`TRUNCATE TABLE service_options CASCADE`);
  await db.execute(sql`TRUNCATE TABLE service_addons CASCADE`);
  await db.execute(sql`TRUNCATE TABLE services CASCADE`);
  await db.execute(sql`TRUNCATE TABLE subcategories CASCADE`);
  await db.execute(sql`TRUNCATE TABLE categories CASCADE`);
  console.log('✓ Existing data cleared\n');

  // Import in order (respecting foreign keys)
  if (data.categories.length) {
    await db.insert(schema.categories).values(data.categories);
    console.log(`✓ Imported ${data.categories.length} categories`);
  }

  if (data.subcategories.length) {
    await db.insert(schema.subcategories).values(data.subcategories);
    console.log(`✓ Imported ${data.subcategories.length} subcategories`);
  }

  if (data.services.length) {
    await db.insert(schema.services).values(data.services);
    console.log(`✓ Imported ${data.services.length} services`);
  }

  if (data.serviceAddons.length) {
    await db.insert(schema.serviceAddons).values(data.serviceAddons);
    console.log(`✓ Imported ${data.serviceAddons.length} service addons`);
  }

  if (data.serviceOptions.length) {
    await db.insert(schema.serviceOptions).values(data.serviceOptions);
    console.log(`✓ Imported ${data.serviceOptions.length} service options`);
  }

  if (data.serviceFrequencies.length) {
    await db.insert(schema.serviceFrequencies).values(data.serviceFrequencies);
    console.log(`✓ Imported ${data.serviceFrequencies.length} service frequencies`);
  }

  if (data.bookings.length) {
    const bookings = data.bookings.map((b: any) => convertDates(b, ['createdAt']));
    await db.insert(schema.bookings).values(bookings);
    console.log(`✓ Imported ${data.bookings.length} bookings`);
  }

  if (data.bookingItems.length) {
    await db.insert(schema.bookingItems).values(data.bookingItems);
    console.log(`✓ Imported ${data.bookingItems.length} booking items`);
  }

  if (data.companySettings.length) {
    await db.insert(schema.companySettings).values(data.companySettings);
    console.log(`✓ Imported ${data.companySettings.length} company settings`);
  }

  if (data.integrationSettings.length) {
    const integrationSettings = data.integrationSettings.map((i: any) => convertDates(i, ['createdAt', 'updatedAt']));
    await db.insert(schema.integrationSettings).values(integrationSettings);
    console.log(`✓ Imported ${data.integrationSettings.length} integration settings`);
  }

  if (data.faqs.length) {
    await db.insert(schema.faqs).values(data.faqs);
    console.log(`✓ Imported ${data.faqs.length} faqs`);
  }

  if (data.blogPosts.length) {
    const blogPosts = data.blogPosts.map((b: any) => convertDates(b, ['createdAt', 'updatedAt', 'publishedAt']));
    await db.insert(schema.blogPosts).values(blogPosts);
    console.log(`✓ Imported ${data.blogPosts.length} blog posts`);
  }

  if (data.blogPostServices.length) {
    await db.insert(schema.blogPostServices).values(data.blogPostServices);
    console.log(`✓ Imported ${data.blogPostServices.length} blog post services`);
  }

  if (data.conversations.length) {
    const conversations = data.conversations.map((c: any) => convertDates(c, ['createdAt', 'updatedAt', 'lastMessageAt']));
    await db.insert(schema.conversations).values(conversations);
    console.log(`✓ Imported ${data.conversations.length} conversations`);
  }

  if (data.conversationMessages.length) {
    const messages = data.conversationMessages.map((m: any) => convertDates(m, ['createdAt']));
    await db.insert(schema.conversationMessages).values(messages);
    console.log(`✓ Imported ${data.conversationMessages.length} messages`);
  }

  if (data.chatSettings.length) {
    const chatSettings = data.chatSettings.map((c: any) => convertDates(c, ['createdAt', 'updatedAt']));
    await db.insert(schema.chatSettings).values(chatSettings);
    console.log(`✓ Imported ${data.chatSettings.length} chat settings`);
  }

  if (data.chatIntegrations.length) {
    const chatIntegrations = data.chatIntegrations.map((c: any) => convertDates(c, ['createdAt', 'updatedAt']));
    await db.insert(schema.chatIntegrations).values(chatIntegrations);
    console.log(`✓ Imported ${data.chatIntegrations.length} chat integrations`);
  }

  if (data.twilioSettings.length) {
    const twilioSettings = data.twilioSettings.map((t: any) => convertDates(t, ['createdAt', 'updatedAt']));
    await db.insert(schema.twilioSettings).values(twilioSettings);
    console.log(`✓ Imported ${data.twilioSettings.length} twilio settings`);
  }

  console.log('\n✅ Import complete!');
  process.exit(0);
}

importData().catch(console.error);
