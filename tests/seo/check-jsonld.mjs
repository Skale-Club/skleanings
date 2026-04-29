// tests/seo/check-jsonld.mjs — ESM helper for parsing JSON-LD from stdin and verifying schema name.
// Usage:  curl -s "$BASE_URL/" | node tests/seo/check-jsonld.mjs "<expected-name>"
// Stdout:  OK:<name>   on success
// Exit:    0 success, 1 schema mismatch, 2 parse error, 3 no JSON-LD found
import { stdin } from "node:process";

const expected = process.argv[2] ?? "";
let html = "";
for await (const chunk of stdin) html += chunk;

const m = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/);
if (!m) {
  console.log("NOMATCH");
  process.exit(3);
}
let j;
try {
  j = JSON.parse(m[1]);
} catch (e) {
  console.log("PARSEERR:" + e.message);
  process.exit(2);
}
if (j["@type"] !== "LocalBusiness" || !j.name) {
  console.log("BADSCHEMA");
  process.exit(1);
}
// If expected provided, assert it matches schema.name. Empty expected = accept any non-empty name
// (industry-fallback case where companyName is null/empty in DB).
if (expected && j.name !== expected) {
  console.log(`MISMATCH:expected=${expected};got=${j.name}`);
  process.exit(1);
}
console.log("OK:" + j.name);
