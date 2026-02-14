import { db } from '../db';
import * as schema from '@shared/schema';
import fs from 'fs';

async function exportData() {
  console.log('Exporting data from Replit database...');

  const data = {
    categories: await db.select().from(schema.categories),
    subcategories: await db.select().from(schema.subcategories),
    services: await db.select().from(schema.services),
    serviceAddons: await db.select().from(schema.serviceAddons),
    serviceOptions: await db.select().from(schema.serviceOptions),
    serviceFrequencies: await db.select().from(schema.serviceFrequencies),
    bookings: await db.select().from(schema.bookings),
    bookingItems: await db.select().from(schema.bookingItems),
    companySettings: await db.select().from(schema.companySettings),
    integrationSettings: await db.select().from(schema.integrationSettings),
    faqs: await db.select().from(schema.faqs),
    blogPosts: await db.select().from(schema.blogPosts),
    blogPostServices: await db.select().from(schema.blogPostServices),
    conversations: await db.select().from(schema.conversations),
    conversationMessages: await db.select().from(schema.conversationMessages),
    chatSettings: await db.select().from(schema.chatSettings),
    chatIntegrations: await db.select().from(schema.chatIntegrations),
    twilioSettings: await db.select().from(schema.twilioSettings),
  };

  fs.writeFileSync(
    'data-export.json',
    JSON.stringify(data, null, 2)
  );

  console.log('Export complete! File saved: data-export.json');
  console.log('Total records:', Object.values(data).reduce((sum, arr) => sum + arr.length, 0));
  process.exit(0);
}

exportData().catch(console.error);