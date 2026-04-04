import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import * as dotenv from "dotenv";

if (!process.env.VERCEL) {
  dotenv.config();
}

const isServerless = !!process.env.VERCEL;

// Serverless: POSTGRES_URL (pgBouncer pooler) is the only reachable host from Vercel.
// POSTGRES_URL_NON_POOLING (direct db.*.supabase.co) is firewalled and always times out.
const DATABASE_URL = isServerless
  ? process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || ""
  : process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || "";

const { Pool } = pg;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING must be set. Did you forget to provision a database?",
  );
}

const connectionString = DATABASE_URL.replace(/([?&])sslmode=[^&]*(&)?/gi, (_, prefix: string, suffix?: string) => {
  if (prefix === "?" && suffix) {
    return "?";
  }
  return "";
}).replace(/[?&]$/, "");

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: isServerless ? 1 : 10,
  idleTimeoutMillis: isServerless ? 5000 : 30000,
  connectionTimeoutMillis: 8000,
});

pool.on("error", (error) => {
  console.error("[DB] Pool idle client error:", error);
});

export const db = drizzle(pool, { schema });
