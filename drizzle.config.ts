import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Carregar .env
dotenv.config();

function isSupabasePoolerUrl(value?: string) {
  return !!value && value.includes("pooler.supabase.com");
}

function toSupabaseDirectUrl(value?: string) {
  if (!value || !isSupabasePoolerUrl(value)) {
    return value;
  }

  try {
    const parsedUrl = new URL(value);
    const ref = parsedUrl.username.match(/^postgres\.([a-z0-9]+)/i)?.[1];

    if (!ref) {
      return value;
    }

    parsedUrl.hostname = `db.${ref}.supabase.co`;
    parsedUrl.port = "5432";
    parsedUrl.username = "postgres";

    console.log("[Drizzle] Converted Supabase pooler URL to direct connection for migrations");
    return parsedUrl.toString();
  } catch {
    return value;
  }
}

const directDatabaseUrl = process.env.DATABASE_URL && !isSupabasePoolerUrl(process.env.DATABASE_URL)
  ? process.env.DATABASE_URL
  : undefined;

const DATABASE_URL = process.env.POSTGRES_URL_NON_POOLING
  || directDatabaseUrl
  || toSupabaseDirectUrl(process.env.DATABASE_URL)
  || toSupabaseDirectUrl(process.env.POSTGRES_URL);

if (!DATABASE_URL) {
  throw new Error("POSTGRES_URL_NON_POOLING, DATABASE_URL, or POSTGRES_URL is required. Check your .env file!");
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
