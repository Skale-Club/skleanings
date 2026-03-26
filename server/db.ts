import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import * as dotenv from "dotenv";

// Carregar .env apenas se não estiver no Vercel (Vercel injeta variáveis automaticamente)
if (!process.env.VERCEL) {
  dotenv.config();
}

// Usar DATABASE_URL ou POSTGRES_URL (Vercel Postgres)
// Vercel Postgres cria POSTGRES_URL automaticamente
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

const { Pool } = pg;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL or POSTGRES_URL must be set. Did you forget to provision a database?",
  );
}

const parsedUrl = new URL(DATABASE_URL);
const isLocalhost = parsedUrl.hostname.includes('localhost') || parsedUrl.hostname.includes('127.0.0.1');
const isServerless = !!process.env.VERCEL;

// Configurar pool com SSL explícito
export const pool = new Pool({
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
  database: parsedUrl.pathname.replace(/^\//, ''),
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  // Forçar SSL com rejectUnauthorized: false para qualquer banco não-localhost
  ssl: { rejectUnauthorized: false },
  max: isServerless ? 1 : 10,
  idleTimeoutMillis: isServerless ? 5000 : 30000,
  connectionTimeoutMillis: 30000, // 30 segundos para serverless cold start
});

// Avoid process crashes on transient idle-client disconnects (e.g. ECONNRESET from pooler/network).
pool.on("error", (error) => {
  console.error("[DB] Pool idle client error:", error);
});

export const db = drizzle(pool, { schema });
