import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

// URL do Supabase PROD (forçada)
const PROD_URL = 'postgresql://postgres.lsrlnlcdrshzzhqvklqc:Consolers%231782@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
const DEV_URL = 'postgresql://postgres.wnwvabwkjofhkwcewijx:Consolers%231782@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const env = process.argv[2] || 'prod';
const url = env === 'dev' ? DEV_URL : PROD_URL;

console.log(`Connecting to ${env.toUpperCase()}...`);

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });

async function createTables() {
  const client = await pool.connect();

  try {
    // Verificar conexão
    const dbInfo = await client.query('SELECT current_database()');
    console.log('Connected to:', dbInfo.rows[0].current_database);

    // Criar tabelas manualmente
    console.log('\nCreating tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        image_url TEXT,
        "order" INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS subcategories (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        "order" INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id),
        subcategory_id INTEGER REFERENCES subcategories(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2),
        duration_minutes INTEGER,
        image_url TEXT,
        is_hidden BOOLEAN DEFAULT false,
        is_archived BOOLEAN DEFAULT false,
        "order" INTEGER DEFAULT 0,
        pricing_type VARCHAR(50) DEFAULT 'fixed_item',
        base_price DECIMAL(10,2),
        price_per_unit DECIMAL(10,2),
        minimum_price DECIMAL(10,2),
        area_sizes JSONB
      );

      CREATE TABLE IF NOT EXISTS service_addons (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id),
        addon_service_id INTEGER REFERENCES services(id),
        discount_percent INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS service_options (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id),
        name VARCHAR(255) NOT NULL,
        price_adjustment DECIMAL(10,2) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS service_frequencies (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id),
        name VARCHAR(255) NOT NULL,
        discount_percent INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_address TEXT,
        customer_zipcode VARCHAR(20),
        booking_date DATE,
        start_time VARCHAR(10),
        end_time VARCHAR(10),
        total_price DECIMAL(10,2),
        total_duration INTEGER,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        ghl_appointment_id VARCHAR(255),
        ghl_contact_id VARCHAR(255),
        conversation_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS booking_items (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id),
        service_id INTEGER,
        service_name VARCHAR(255),
        quantity INTEGER DEFAULT 1,
        unit_price DECIMAL(10,2),
        total_price DECIMAL(10,2),
        duration_minutes INTEGER,
        options JSONB,
        frequency JSONB
      );

      CREATE TABLE IF NOT EXISTS company_settings (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        business_hours JSONB,
        time_slot_duration INTEGER DEFAULT 30,
        minimum_booking_value DECIMAL(10,2) DEFAULT 0,
        seo_title VARCHAR(255),
        seo_description TEXT,
        seo_keywords TEXT,
        og_image TEXT,
        twitter_creator VARCHAR(100),
        robots_txt TEXT,
        gtm_id VARCHAR(50),
        gtag_id VARCHAR(50),
        fb_pixel_id VARCHAR(50),
        cta_text VARCHAR(255),
        cta_button_text VARCHAR(100),
        time_format VARCHAR(10) DEFAULT '12h'
      );

      CREATE TABLE IF NOT EXISTS integration_settings (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50),
        api_key TEXT,
        location_id VARCHAR(255),
        calendar_id VARCHAR(255),
        is_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        "order" INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS blog_posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        excerpt TEXT,
        content TEXT,
        featured_image TEXT,
        is_published BOOLEAN DEFAULT false,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS blog_post_services (
        id SERIAL PRIMARY KEY,
        blog_post_id INTEGER REFERENCES blog_posts(id),
        service_id INTEGER REFERENCES services(id)
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_message_at TIMESTAMP,
        first_page_url TEXT,
        visitor_name VARCHAR(255),
        visitor_phone VARCHAR(50),
        visitor_email VARCHAR(255),
        visitor_address TEXT,
        visitor_zipcode VARCHAR(20),
        memory JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        conversation_id UUID REFERENCES conversations(id),
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        tool_calls JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_settings (
        id SERIAL PRIMARY KEY,
        site_id VARCHAR(255) NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        welcome_message TEXT,
        primary_color VARCHAR(20),
        position VARCHAR(20) DEFAULT 'bottom-right',
        url_rules JSONB,
        openai_api_key TEXT,
        avatar_url TEXT,
        system_prompt TEXT,
        intake_objectives JSONB,
        consultative_prompt TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_integrations (
        id SERIAL PRIMARY KEY,
        chat_settings_id INTEGER REFERENCES chat_settings(id),
        provider VARCHAR(50),
        is_enabled BOOLEAN DEFAULT false,
        config JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS twilio_settings (
        id SERIAL PRIMARY KEY,
        account_sid VARCHAR(255),
        auth_token TEXT,
        phone_number VARCHAR(50),
        is_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS time_slot_locks (
        id SERIAL PRIMARY KEY,
        booking_date DATE NOT NULL,
        start_time VARCHAR(10) NOT NULL,
        conversation_id VARCHAR(255) NOT NULL,
        locked_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        profile_image_url TEXT,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR(255) PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      );
    `);

    console.log('✓ Tables created!');

    // Listar tabelas
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('\nTables now:', tables.rows.length);
    tables.rows.forEach(r => console.log('  -', r.table_name));

  } finally {
    client.release();
    await pool.end();
  }
}

createTables().catch(console.error);
