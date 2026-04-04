import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import * as dotenv from "dotenv";

if (!process.env.VERCEL) {
  dotenv.config();
}

const isServerless = !!process.env.VERCEL;

// Serverless: POSTGRES_URL (pgBouncer pooler, port 6543) is the only reachable host from Vercel.
// Using postgres.js driver instead of pg — handles pgBouncer SCRAM-SHA-256 correctly.
const DATABASE_URL = isServerless
  ? process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || ""
  : process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || "";

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING must be set. Did you forget to provision a database?",
  );
}

export const connection = postgres(DATABASE_URL, {
  ssl: "require",
  max: isServerless ? 1 : 10,
  idle_timeout: isServerless ? 5 : 30,
  connect_timeout: 8,
  prepare: false, // Required for pgBouncer transaction mode
});

export const db = drizzle(connection, { schema });
