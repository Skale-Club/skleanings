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

function mergePoolerPassword(pooledConnectionString: string, directConnectionString: string): string {
  try {
    const pooled = new URL(pooledConnectionString);
    const direct = new URL(directConnectionString);

    if (!pooled.password && !direct.password) {
      return pooledConnectionString;
    }

    if (pooled.password === direct.password) {
      return pooledConnectionString;
    }

    pooled.password = direct.password;
    return pooled.toString();
  } catch {
    return pooledConnectionString;
  }
}

const databaseUrl = process.env.DATABASE_URL || "";
const pooledUrl = process.env.POSTGRES_URL || "";
const nonPoolingUrl = process.env.POSTGRES_URL_NON_POOLING || "";

const repairedPooledUrl = pooledUrl && databaseUrl
  ? mergePoolerPassword(pooledUrl, databaseUrl)
  : pooledUrl;

// On Vercel, the direct `db.<ref>.supabase.co` host has been failing DNS resolution,
// while the pooler works if we reuse the password embedded in DATABASE_URL.
const DATABASE_URL = isServerless
  ? repairedPooledUrl || pooledUrl || databaseUrl || nonPoolingUrl
  : databaseUrl || pooledUrl || nonPoolingUrl;

const connectionSource = DATABASE_URL === repairedPooledUrl && repairedPooledUrl !== pooledUrl
  ? "POSTGRES_URL+DATABASE_URL_PASSWORD"
  : DATABASE_URL === databaseUrl
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
