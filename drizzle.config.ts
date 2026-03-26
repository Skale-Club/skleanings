import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carregar .env
dotenv.config();

let dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Convert Supabase pooler URL to direct connection for migrations
// Pooler: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// Direct: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
if (dbUrl && dbUrl.includes('pooler.supabase.com')) {
  const match = dbUrl.match(/postgres\.([a-z0-9]+):([^@]+)@aws-0-([a-z0-9-]+)\.pooler\.supabase\.com:6543\/postgres/);
  if (match) {
    const [, ref, password] = match;
    dbUrl = `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`;
    console.log('[Drizzle] Converted pooler URL to direct connection for migrations');
  }
}

const DATABASE_URL = dbUrl;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Check your .env file!");
}

console.log('[Drizzle] Database:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
