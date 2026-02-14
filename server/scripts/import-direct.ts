import pg from 'pg';
import fs from 'fs';

// URLs diretas do Supabase
const PROD_URL = 'postgresql://postgres.lsrlnlcdrshzzhqvklqc:Consolers%231782@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const DEV_URL = 'postgresql://postgres.wnwvabwkjofhkwcewijx:Consolers%231782@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const env = process.argv[2] || 'prod';
const url = env === 'dev' ? DEV_URL : PROD_URL;

console.log(`Importing data to ${env.toUpperCase()}...`);

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

// Helper to format value for SQL
function formatValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function importData() {
  const data = JSON.parse(fs.readFileSync('data-export.json', 'utf-8'));
  const client = await pool.connect();

  try {
    console.log('Connected to:', (await client.query('SELECT current_database()')).rows[0].current_database);

    // Categories
    if (data.categories?.length) {
      for (const cat of data.categories) {
        await client.query(`
          INSERT INTO categories (id, name, slug, description, image_url, "order")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET name = $2, slug = $3, description = $4, image_url = $5, "order" = $6
        `, [cat.id, cat.name, cat.slug, cat.description, cat.imageUrl, cat.order]);
      }
      console.log(`✓ Imported ${data.categories.length} categories`);
    }

    // Services
    if (data.services?.length) {
      for (const svc of data.services) {
        await client.query(`
          INSERT INTO services (id, category_id, subcategory_id, name, description, price, duration_minutes, image_url, is_hidden, is_archived, "order", pricing_type, base_price, price_per_unit, minimum_price, area_sizes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET name = $4, description = $5, price = $6
        `, [svc.id, svc.categoryId, svc.subcategoryId, svc.name, svc.description, svc.price, svc.durationMinutes, svc.imageUrl, svc.isHidden, svc.isArchived, svc.order, svc.pricingType, svc.basePrice, svc.pricePerUnit, svc.minimumPrice, svc.areaSizes ? JSON.stringify(svc.areaSizes) : null]);
      }
      console.log(`✓ Imported ${data.services.length} services`);
    }

    // Service Addons
    if (data.serviceAddons?.length) {
      for (const addon of data.serviceAddons) {
        await client.query(`
          INSERT INTO service_addons (id, service_id, addon_service_id, discount_percent)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [addon.id, addon.serviceId, addon.addonServiceId, addon.discountPercent]);
      }
      console.log(`✓ Imported ${data.serviceAddons.length} service addons`);
    }

    // Bookings
    if (data.bookings?.length) {
      for (const b of data.bookings) {
        await client.query(`
          INSERT INTO bookings (id, customer_name, customer_email, customer_phone, customer_address, customer_zipcode, booking_date, start_time, end_time, total_price, total_duration, status, notes, ghl_appointment_id, ghl_contact_id, conversation_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO NOTHING
        `, [b.id, b.customerName, b.customerEmail, b.customerPhone, b.customerAddress, b.customerZipcode, b.bookingDate, b.startTime, b.endTime, b.totalPrice, b.totalDuration, b.status, b.notes, b.ghlAppointmentId, b.ghlContactId, b.conversationId, b.createdAt]);
      }
      console.log(`✓ Imported ${data.bookings.length} bookings`);
    }

    // Booking Items
    if (data.bookingItems?.length) {
      for (const bi of data.bookingItems) {
        await client.query(`
          INSERT INTO booking_items (id, booking_id, service_id, service_name, quantity, unit_price, total_price, duration_minutes, options, frequency)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [bi.id, bi.bookingId, bi.serviceId, bi.serviceName, bi.quantity, bi.unitPrice, bi.totalPrice, bi.durationMinutes, bi.options ? JSON.stringify(bi.options) : null, bi.frequency ? JSON.stringify(bi.frequency) : null]);
      }
      console.log(`✓ Imported ${data.bookingItems.length} booking items`);
    }

    // Company Settings
    if (data.companySettings?.length) {
      const cs = data.companySettings[0];
      await client.query(`
        INSERT INTO company_settings (id, company_name, phone, email, address, business_hours, time_slot_duration, minimum_booking_value, seo_title, seo_description, seo_keywords, og_image, twitter_creator, robots_txt, gtm_id, gtag_id, fb_pixel_id, cta_text, cta_button_text, time_format)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT (id) DO UPDATE SET company_name = $2, phone = $3, email = $4
      `, [cs.id, cs.companyName, cs.phone, cs.email, cs.address, cs.businessHours ? JSON.stringify(cs.businessHours) : null, cs.timeSlotDuration, cs.minimumBookingValue, cs.seoTitle, cs.seoDescription, cs.seoKeywords, cs.ogImage, cs.twitterCreator, cs.robotsTxt, cs.gtmId, cs.gtagId, cs.fbPixelId, cs.ctaText, cs.ctaButtonText, cs.timeFormat]);
      console.log(`✓ Imported ${data.companySettings.length} company settings`);
    }

    // Integration Settings
    if (data.integrationSettings?.length) {
      const is = data.integrationSettings[0];
      await client.query(`
        INSERT INTO integration_settings (id, provider, api_key, location_id, calendar_id, is_enabled, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET api_key = $3, location_id = $4, calendar_id = $5
      `, [is.id, is.provider, is.apiKey, is.locationId, is.calendarId, is.isEnabled, is.createdAt, is.updatedAt]);
      console.log(`✓ Imported ${data.integrationSettings.length} integration settings`);
    }

    // FAQs
    if (data.faqs?.length) {
      for (const faq of data.faqs) {
        await client.query(`
          INSERT INTO faqs (id, question, answer, "order")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [faq.id, faq.question, faq.answer, faq.order]);
      }
      console.log(`✓ Imported ${data.faqs.length} faqs`);
    }

    // Blog Posts
    if (data.blogPosts?.length) {
      for (const bp of data.blogPosts) {
        await client.query(`
          INSERT INTO blog_posts (id, title, slug, excerpt, content, featured_image, is_published, published_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [bp.id, bp.title, bp.slug, bp.excerpt, bp.content, bp.featuredImage, bp.isPublished, bp.publishedAt, bp.createdAt, bp.updatedAt]);
      }
      console.log(`✓ Imported ${data.blogPosts.length} blog posts`);
    }

    // Blog Post Services
    if (data.blogPostServices?.length) {
      for (const bps of data.blogPostServices) {
        await client.query(`
          INSERT INTO blog_post_services (id, blog_post_id, service_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO NOTHING
        `, [bps.id, bps.blogPostId, bps.serviceId]);
      }
      console.log(`✓ Imported ${data.blogPostServices.length} blog post services`);
    }

    // Conversations
    if (data.conversations?.length) {
      for (const conv of data.conversations) {
        await client.query(`
          INSERT INTO conversations (id, status, created_at, updated_at, last_message_at, first_page_url, visitor_name, visitor_phone, visitor_email, visitor_address, visitor_zipcode, memory)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [conv.id, conv.status, conv.createdAt, conv.updatedAt, conv.lastMessageAt, conv.firstPageUrl, conv.visitorName, conv.visitorPhone, conv.visitorEmail, conv.visitorAddress, conv.visitorZipcode, conv.memory ? JSON.stringify(conv.memory) : '{}']);
      }
      console.log(`✓ Imported ${data.conversations.length} conversations`);
    }

    // Conversation Messages
    if (data.conversationMessages?.length) {
      let imported = 0;
      for (const msg of data.conversationMessages) {
        try {
          await client.query(`
            INSERT INTO conversation_messages (id, conversation_id, role, content, tool_calls, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
          `, [msg.id, msg.conversationId, msg.role, msg.content, msg.toolCalls ? JSON.stringify(msg.toolCalls) : null, msg.createdAt]);
          imported++;
        } catch (e) {
          // Skip messages with missing conversation
        }
      }
      console.log(`✓ Imported ${imported} conversation messages`);
    }

    // Chat Settings
    if (data.chatSettings?.length) {
      for (const cs of data.chatSettings) {
        await client.query(`
          INSERT INTO chat_settings (id, site_id, is_enabled, welcome_message, primary_color, position, url_rules, openai_api_key, avatar_url, system_prompt, intake_objectives, consultative_prompt, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING
        `, [cs.id, cs.siteId, cs.isEnabled, cs.welcomeMessage, cs.primaryColor, cs.position, cs.urlRules ? JSON.stringify(cs.urlRules) : null, cs.openaiApiKey, cs.avatarUrl, cs.systemPrompt, cs.intakeObjectives ? JSON.stringify(cs.intakeObjectives) : null, cs.consultativePrompt, cs.createdAt, cs.updatedAt]);
      }
      console.log(`✓ Imported ${data.chatSettings.length} chat settings`);
    }

    // Chat Integrations
    if (data.chatIntegrations?.length) {
      for (const ci of data.chatIntegrations) {
        await client.query(`
          INSERT INTO chat_integrations (id, chat_settings_id, provider, is_enabled, config, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING
        `, [ci.id, ci.chatSettingsId, ci.provider, ci.isEnabled, ci.config ? JSON.stringify(ci.config) : null, ci.createdAt, ci.updatedAt]);
      }
      console.log(`✓ Imported ${data.chatIntegrations.length} chat integrations`);
    }

    // Twilio Settings
    if (data.twilioSettings?.length) {
      for (const ts of data.twilioSettings) {
        await client.query(`
          INSERT INTO twilio_settings (id, account_sid, auth_token, phone_number, is_enabled, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING
        `, [ts.id, ts.accountSid, ts.authToken, ts.phoneNumber, ts.isEnabled, ts.createdAt, ts.updatedAt]);
      }
      console.log(`✓ Imported ${data.twilioSettings.length} twilio settings`);
    }

    // Update sequences
    await client.query(`
      SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 1));
      SELECT setval('services_id_seq', COALESCE((SELECT MAX(id) FROM services), 1));
      SELECT setval('bookings_id_seq', COALESCE((SELECT MAX(id) FROM bookings), 1));
      SELECT setval('booking_items_id_seq', COALESCE((SELECT MAX(id) FROM booking_items), 1));
      SELECT setval('faqs_id_seq', COALESCE((SELECT MAX(id) FROM faqs), 1));
      SELECT setval('blog_posts_id_seq', COALESCE((SELECT MAX(id) FROM blog_posts), 1));
      SELECT setval('conversation_messages_id_seq', COALESCE((SELECT MAX(id) FROM conversation_messages), 1));
      SELECT setval('chat_settings_id_seq', COALESCE((SELECT MAX(id) FROM chat_settings), 1));
    `);

    console.log('\n✅ Import complete!');

  } finally {
    client.release();
    await pool.end();
  }
}

importData().catch(console.error);
