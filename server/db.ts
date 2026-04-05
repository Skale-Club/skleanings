import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import * as dotenv from "dotenv";

if (!process.env.VERCEL) {
  dotenv.config();
}

const isServerless = !!process.env.VERCEL;

function getHost(connectionString: string): string {
  try {
    return new URL(connectionString).host;
  } catch {
    return "invalid";
  }
}

const databaseUrl = process.env.DATABASE_URL || "";
const pooledUrl = process.env.POSTGRES_URL || "";
const nonPoolingUrl = process.env.POSTGRES_URL_NON_POOLING || "";

// In Vercel production, DATABASE_URL points at the direct Supabase host (`db.<ref>.supabase.co`),
// while POSTGRES_URL goes through the pooler. The pooler is currently failing with
// SASL_SIGNATURE_MISMATCH in runtime logs, so prefer DATABASE_URL when available.
const DATABASE_URL = isServerless
  ? databaseUrl || pooledUrl || nonPoolingUrl
  : databaseUrl || pooledUrl || nonPoolingUrl;

const connectionSource = DATABASE_URL === databaseUrl
  ? "DATABASE_URL"
  : DATABASE_URL === pooledUrl
    ? "POSTGRES_URL"
    : "POSTGRES_URL_NON_POOLING";

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING must be set. Did you forget to provision a database?",
  );
}

console.log(`[DB] Using ${connectionSource} (${getHost(DATABASE_URL)})`);

export const connection = postgres(DATABASE_URL, {
  ssl: "require",
  max: isServerless ? 1 : 10,
  idle_timeout: isServerless ? 5 : 30,
  connect_timeout: 8,
  prepare: false, // Required for pgBouncer transaction mode
});

export const db = drizzle(connection, { schema });
