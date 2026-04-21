import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";
import * as dotenv from "dotenv";

if (!process.env.VERCEL) {
  dotenv.config();
}

const isServerless = !!process.env.VERCEL;
const SCRAM_RETRY_DELAY_MS = 300;

type ConnectionCandidate = {
  source: string;
  url: string;
};

function getHost(connectionString: string): string {
  try {
    return new URL(connectionString).host;
  } catch {
    return "invalid";
  }
}

function getHostFingerprint(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return `${url.hostname}:${url.port || "5432"}`;
  } catch {
    return "invalid";
  }
}

function isScramHandshakeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("server signature is missing") ||
    message.includes("scram-server-final-message") ||
    message.includes("sasl_signature_mismatch") ||
    message.includes("did not return the correct signature")
  );
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

const connectionCandidates: ConnectionCandidate[] = [];

function pushCandidate(source: string, url: string) {
  if (!url || connectionCandidates.some((candidate) => candidate.url === url)) {
    return;
  }

  connectionCandidates.push({ source, url });
}

if (isServerless) {
  // Prefer the pooled runtime URL on Vercel, but keep a direct URL fallback available
  // for the specific cold-start SCRAM failure mode we are seeing in production.
  pushCandidate(
    repairedPooledUrl && repairedPooledUrl !== pooledUrl
      ? "POSTGRES_URL+DATABASE_URL_PASSWORD"
      : "POSTGRES_URL",
    repairedPooledUrl || pooledUrl,
  );
  pushCandidate("DATABASE_URL", databaseUrl);
  pushCandidate("POSTGRES_URL_NON_POOLING", nonPoolingUrl);
} else {
  pushCandidate("DATABASE_URL", databaseUrl);
  pushCandidate("POSTGRES_URL", repairedPooledUrl || pooledUrl);
  pushCandidate("POSTGRES_URL_NON_POOLING", nonPoolingUrl);
}

const primaryCandidate = connectionCandidates[0];
const fallbackCandidates = connectionCandidates.slice(1);

if (!primaryCandidate) {
  throw new Error(
    "DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING must be set. Did you forget to provision a database?",
  );
}

function createConnection(connectionString: string) {
  return postgres(connectionString, {
    ssl: "require",
    max: isServerless ? 1 : 10,
    idle_timeout: isServerless ? 5 : 30,
    connect_timeout: 8,
    prepare: false, // Required for pgBouncer transaction mode
  });
}

let activeCandidate = primaryCandidate;

console.log(
  `[DB] Boot source=${activeCandidate.source} host=${getHost(activeCandidate.url)} ` +
  `fingerprint=${getHostFingerprint(activeCandidate.url)} serverless=${isServerless}`,
);

export let connection = createConnection(activeCandidate.url);

export let db = drizzle(connection, { schema });

let dbBootstrapPromise: Promise<void> | null = null;

async function switchConnection(nextCandidate: ConnectionCandidate) {
  try {
    await connection.end({ timeout: 1 });
  } catch {
    // Best-effort cleanup only.
  }

  activeCandidate = nextCandidate;
  connection = createConnection(nextCandidate.url);
  db = drizzle(connection, { schema });
}

async function verifyConnection(candidate: ConnectionCandidate) {
  const startedAt = Date.now();

  try {
    await connection`select 1 as healthcheck`;
    console.log(
      `[DB] Warmup ok source=${candidate.source} host=${getHostFingerprint(candidate.url)} ` +
      `durationMs=${Date.now() - startedAt}`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : typeof error;

    console.warn(
      `[DB] Warmup failed source=${candidate.source} host=${getHostFingerprint(candidate.url)} ` +
      `error=${errorName} message=${errorMessage}`,
    );

    throw error;
  }
}

export async function ensureDatabaseReady() {
  if (!dbBootstrapPromise) {
    dbBootstrapPromise = (async () => {
      try {
        await verifyConnection(activeCandidate);
      } catch (error) {
        if (!isServerless || !isScramHandshakeError(error) || fallbackCandidates.length === 0) {
          throw error;
        }

        const fallbackCandidate = fallbackCandidates[0];
        console.warn(
          `[DB] Detected cold-start SCRAM handshake on ${activeCandidate.source}. ` +
          `Retrying with ${fallbackCandidate.source} after ${SCRAM_RETRY_DELAY_MS}ms.`,
        );

        await new Promise((resolve) => setTimeout(resolve, SCRAM_RETRY_DELAY_MS));
        await switchConnection(fallbackCandidate);
        await verifyConnection(fallbackCandidate);
      }
    })().catch((error) => {
      dbBootstrapPromise = null;
      throw error;
    });
  }

  return dbBootstrapPromise;
}
