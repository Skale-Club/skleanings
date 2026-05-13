#!/usr/bin/env node

const [, , name, path] = process.argv;

if (!name || !path) {
  console.error("Usage: node scripts/call-cron-endpoint.mjs <name> <path>");
  process.exit(2);
}

const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
const cronSecret = process.env.CRON_SECRET;
const maxAttempts = Number(process.env.CRON_MAX_ATTEMPTS ?? "3");
const timeoutMs = Number(process.env.CRON_TIMEOUT_MS ?? "60000");

if (!appUrl) {
  console.error("ERROR: APP_URL variable is not configured");
  process.exit(1);
}

if (!cronSecret) {
  console.error("ERROR: CRON_SECRET secret is not configured");
  process.exit(1);
}

const endpoint = new URL(path, `${appUrl}/`).toString();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callEndpoint(attempt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
        "User-Agent": "skleanings-github-cron/1.0",
      },
      signal: controller.signal,
    });

    const bodyText = await response.text();
    let body = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = null;
    }

    return {
      attempt,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body,
      bodyText,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetry(resultOrError) {
  if (resultOrError instanceof Error) {
    return true;
  }

  return resultOrError.status === 408 || resultOrError.status === 409 || resultOrError.status >= 500;
}

function printResult(result) {
  console.log(`Cron: ${name}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Attempt: ${result.attempt}/${maxAttempts}`);
  console.log(`HTTP Status: ${result.status} ${result.statusText}`);
  console.log("Response:");
  console.log(result.body ? JSON.stringify(result.body, null, 2) : result.bodyText || "<empty>");
}

let lastResult = null;
let lastError = null;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    lastResult = await callEndpoint(attempt);
    lastError = null;

    if (lastResult.ok) {
      printResult(lastResult);
      process.exit(0);
    }

    if (lastResult.body?.code === "SCHEMA_NOT_READY") {
      printResult(lastResult);
      console.error("Database migrations are required before this cron can run safely.");
      process.exit(1);
    }

    if (!shouldRetry(lastResult) || attempt === maxAttempts) {
      printResult(lastResult);
      process.exit(1);
    }

    console.warn(`Received HTTP ${lastResult.status}. Retrying after ${attempt * 10}s...`);
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));

    if (!shouldRetry(lastError) || attempt === maxAttempts) {
      console.error(`Cron: ${name}`);
      console.error(`Endpoint: ${endpoint}`);
      console.error(`Request failed: ${lastError.message}`);
      process.exit(1);
    }

    console.warn(`Request failed: ${lastError.message}. Retrying after ${attempt * 10}s...`);
  }

  await sleep(attempt * 10_000);
}

if (lastResult) {
  printResult(lastResult);
}
if (lastError) {
  console.error(lastError.message);
}
process.exit(1);
