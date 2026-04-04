import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import * as dotenv from "dotenv";

// Carregar .env apenas se não estiver no Vercel (Vercel injeta variáveis automaticamente)
if (!process.env.VERCEL) {
  dotenv.config();
}

const isServerless = !!process.env.VERCEL;

type DbUrlSource = "POSTGRES_URL" | "DATABASE_URL" | "POSTGRES_URL_NON_POOLING";

// Serverless: prefer NON_POOLING (direct Supabase TCP) to avoid pgBouncer transaction-mode
// SCRAM-SHA-256 handshake failures. connectionTimeoutMillis: 8000 ensures fast failure if
// the direct connection is slow. pgBouncer (POSTGRES_URL) is kept as last-resort fallback only.
const rawCandidates: Array<{ source: DbUrlSource; url: string | undefined }> = isServerless
  ? [
      { source: "POSTGRES_URL_NON_POOLING", url: process.env.POSTGRES_URL_NON_POOLING },
      { source: "DATABASE_URL", url: process.env.DATABASE_URL },
      { source: "POSTGRES_URL", url: process.env.POSTGRES_URL },
    ]
  : [
      { source: "DATABASE_URL", url: process.env.DATABASE_URL },
      { source: "POSTGRES_URL", url: process.env.POSTGRES_URL },
      { source: "POSTGRES_URL_NON_POOLING", url: process.env.POSTGRES_URL_NON_POOLING },
    ];

const candidates = rawCandidates.filter((candidate): candidate is { source: DbUrlSource; url: string } => Boolean(candidate.url));

const selected = candidates[0];

const { Pool } = pg;

if (!selected) {
  throw new Error(
    "DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING must be set. Did you forget to provision a database?",
  );
}

function sanitizeConnectionString(rawUrl: string): string {
  return rawUrl
    .replace(/([?&])sslmode=[^&]*(&)?/gi, (_, prefix: string, suffix?: string) => {
      if (prefix === "?" && suffix) {
        return "?";
      }
      return "";
    })
    .replace(/([?&])channel_binding=[^&]*(&)?/gi, (_, prefix: string, suffix?: string) => {
      if (prefix === "?" && suffix) {
        return "?";
      }
      return "";
    })
    .replace(/[?&]$/, "");
}

function getConnectionFingerprint(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    return {
      host: parsed.hostname || "unknown",
      port: parsed.port || "5432",
      dbName: parsed.pathname.replace(/^\//, "") || "unknown",
      hadSslMode: parsed.searchParams.has("sslmode"),
      hadChannelBinding: parsed.searchParams.has("channel_binding"),
    };
  } catch {
    return {
      host: "unparseable",
      port: "unknown",
      dbName: "unknown",
      hadSslMode: false,
      hadChannelBinding: false,
    };
  }
}

function isScramSignatureError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("scram-server-final-message") || message.includes("server signature is missing");
}

const fingerprint = getConnectionFingerprint(selected.url);
const connectionString = sanitizeConnectionString(selected.url);

console.info(
  `[DB] init source=${selected.source} host=${fingerprint.host} port=${fingerprint.port} db=${fingerprint.dbName} serverless=${isServerless} strippedSslMode=${fingerprint.hadSslMode} strippedChannelBinding=${fingerprint.hadChannelBinding}`,
);

// Configurar pool com SSL explícito
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: isServerless ? 1 : 10,
  idleTimeoutMillis: isServerless ? 5000 : 30000,
  connectionTimeoutMillis: 8000,
});

const rawPoolQuery = pool.query.bind(pool) as typeof pool.query;
let scramRetryUsed = false;

pool.query = (async (...args: Parameters<typeof rawPoolQuery>) => {
  try {
    return await rawPoolQuery(...args);
  } catch (error) {
    if (!scramRetryUsed && isScramSignatureError(error)) {
      scramRetryUsed = true;
      console.warn("[DB] SCRAM handshake error on first query. Retrying once.");
      await new Promise((resolve) => setTimeout(resolve, 250));
      return rawPoolQuery(...args);
    }
    throw error;
  }
}) as typeof pool.query;

// Avoid process crashes on transient idle-client disconnects (e.g. ECONNRESET from pooler/network).
pool.on("error", (error) => {
  if (isScramSignatureError(error)) {
    console.error(`[DB] Pool idle SCRAM error source=${selected.source}:`, error);
    return;
  }
  console.error("[DB] Pool idle client error:", error);
});

export const db = drizzle(pool, { schema });
