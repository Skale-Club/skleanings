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

// Remover sslmode da URL para evitar conflito com configuração manual
// O pg driver precisa de ssl config explícito, não via query string
let connectionString = DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
// Limpar ? ou & soltos no final
connectionString = connectionString.replace(/[?&]$/, '');

const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const isServerless = !!process.env.VERCEL;

console.log('DB Config:', {
  isLocalhost,
  isServerless,
  hasPostgresUrl: !!process.env.POSTGRES_URL,
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  urlPreview: connectionString.substring(0, 50) + '...'
});

// Configurar pool com SSL explícito
export const pool = new Pool({
  connectionString,
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
