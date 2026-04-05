type RuntimeEnvDiagnostics = {
  errors: string[];
  warnings: string[];
};

function readEnv(
  env: NodeJS.ProcessEnv,
  keys: string[],
): string {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function parseConnectionString(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function collectRuntimeEnvDiagnostics(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeEnvDiagnostics {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nodeEnv = env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";
  const isServerless = !!env.VERCEL;

  const databaseUrl = readEnv(env, ["DATABASE_URL"]);
  const pooledUrl = readEnv(env, ["POSTGRES_URL"]);
  const nonPoolingUrl = readEnv(env, ["POSTGRES_URL_NON_POOLING"]);
  const sessionSecret = readEnv(env, ["SESSION_SECRET"]);
  const supabaseUrl = readEnv(env, [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "VITE_SUPABASE_URL",
  ]);
  const supabasePublishableKey = readEnv(env, [
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  ]);
  const cronSecret = readEnv(env, ["CRON_SECRET"]);

  if (!databaseUrl && !pooledUrl && !nonPoolingUrl) {
    errors.push(
      "Missing database connection string. Set DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING.",
    );
  }

  if (isProduction && !sessionSecret) {
    errors.push("SESSION_SECRET is required in production.");
  } else if (!sessionSecret) {
    warnings.push("SESSION_SECRET is not set. Development sessions will use a weak fallback secret.");
  }

  if (!supabaseUrl) {
    warnings.push(
      "Supabase URL is not configured. Google/admin authentication will not work until SUPABASE_URL or VITE_SUPABASE_URL is set.",
    );
  }

  if (!supabasePublishableKey) {
    warnings.push(
      "Supabase publishable/anon key is not configured. Browser authentication will fail until VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY is set.",
    );
  }

  if (!cronSecret) {
    warnings.push(
      "CRON_SECRET is not configured. Protected cron endpoints such as blog autopost will reject requests.",
    );
  }

  if (isServerless && !pooledUrl) {
    warnings.push(
      "POSTGRES_URL is not configured for serverless runtime. Prefer the pooled Supabase URL on Vercel to avoid direct-host DNS and connection issues.",
    );
  }

  const parsedDatabaseUrl = parseConnectionString(databaseUrl);
  const parsedPooledUrl = parseConnectionString(pooledUrl);

  if (isServerless && parsedDatabaseUrl && parsedDatabaseUrl.hostname.startsWith("db.") && !pooledUrl) {
    warnings.push(
      `DATABASE_URL points to the direct host ${parsedDatabaseUrl.host} without POSTGRES_URL. This is risky on Vercel; configure the pooled URL as well.`,
    );
  }

  if (parsedDatabaseUrl && !parsedDatabaseUrl.password) {
    warnings.push("DATABASE_URL is missing a password.");
  }

  if (parsedPooledUrl && !parsedPooledUrl.password) {
    warnings.push("POSTGRES_URL is missing a password.");
  }

  if (parsedDatabaseUrl && parsedPooledUrl) {
    if (parsedDatabaseUrl.password && parsedPooledUrl.password && parsedDatabaseUrl.password !== parsedPooledUrl.password) {
      warnings.push(
        "POSTGRES_URL password differs from DATABASE_URL password. The app can repair this on Vercel, but the environment should be corrected to avoid drift.",
      );
    }

    if (parsedDatabaseUrl.username && parsedPooledUrl.username && parsedDatabaseUrl.username !== parsedPooledUrl.username) {
      warnings.push(
        "POSTGRES_URL username differs from DATABASE_URL username. Double-check that both connection strings target the same database project.",
      );
    }
  }

  return { errors, warnings };
}

export function assertRuntimeEnv(env: NodeJS.ProcessEnv = process.env) {
  const diagnostics = collectRuntimeEnvDiagnostics(env);

  for (const warning of diagnostics.warnings) {
    console.warn(`[Env] ${warning}`);
  }

  if (diagnostics.errors.length > 0) {
    for (const error of diagnostics.errors) {
      console.error(`[Env] ${error}`);
    }

    throw new Error("Runtime environment validation failed.");
  }

  return diagnostics;
}
