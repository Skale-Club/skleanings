// tests/seo/jsonld-parity.test.mjs
// Plan 16-03 parity test — TWO real assertions (not a trivial double-call):
//   (A) Server's injectSeoMeta output's JSON-LD body == direct buildLocalBusinessSchema(settings, url) call.
//       Proves the server actually delegates to the shared util.
//   (B) client/src/hooks/use-seo.ts contains no inline { "@type": "LocalBusiness", ... } object literal.
//       Proves the client doesn't reintroduce a duplicate schema-builder.
// Run with: npx tsx tests/seo/jsonld-parity.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { injectSeoMeta } from "../../server/lib/seo-injector.ts";
import { buildLocalBusinessSchema } from "../../shared/seo.ts";

// Minimal template — only the JSON-LD slot is exercised; other tokens get default empty replacements.
const TEMPLATE = `<!DOCTYPE html><html><head>
  <title>{{SEO_TITLE}}</title>
  <meta name="description" content="{{SEO_DESCRIPTION}}" />
  <link rel="canonical" href="{{CANONICAL_URL}}" />
  {{OG_IMAGE_BLOCK}}
  <meta property="og:type" content="{{OG_TYPE}}" />
  <meta property="og:locale" content="{{OG_LOCALE}}" />
  <meta property="og:site_name" content="{{OG_SITE_NAME}}" />
  <meta name="twitter:card" content="{{TWITTER_CARD}}" />
  <meta name="twitter:site" content="{{TWITTER_SITE}}" />
  <meta name="twitter:creator" content="{{TWITTER_CREATOR}}" />
  {{TWITTER_IMAGE_BLOCK}}
  <meta name="robots" content="{{ROBOTS}}" />
  <script type="application/ld+json">{{JSON_LD}}</script>
</head><body></body></html>`;

const REQ = { protocol: "https", host: "tenant.example.com", originalUrl: "/" };

function extractJsonLdBody(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, "JSON-LD block not found");
  return m[1];
}

// canonicalize a JSON string by parse → stringify (stable key order from V8 + no whitespace differences)
function canon(jsonString) {
  return JSON.stringify(JSON.parse(jsonString));
}

// Compute the canonical URL the SAME WAY the injector does for each fixture, so the EXPECTED
// shared-builder call uses the same URL the server passes in.
function expectedCanonical(settings, req) {
  if (settings && settings.seoCanonicalUrl) {
    return settings.seoCanonicalUrl.replace(/\/$/, "") || settings.seoCanonicalUrl;
  }
  const host = req.host || "localhost:5000";
  const p = req.originalUrl || "/";
  const trimmed = `${req.protocol}://${host}${p}`.replace(/\/$/, "");
  return trimmed || `${req.protocol}://${host}/`;
}

// The injector also absolutizes ogImage and passes a synthetic settings object to the schema builder.
// We mirror that so the EXPECTED call matches what the server actually does.
function settingsForSchema(settings, req) {
  if (!settings) return null;
  const ogImageAbsolute = settings.ogImage
    ? (settings.ogImage.startsWith("http")
        ? settings.ogImage
        : `${req.protocol}://${req.host || "localhost"}${settings.ogImage}`)
    : "";
  return { ...settings, ogImage: ogImageAbsolute || settings.ogImage };
}

// ---------- ASSERTION (A): server-rendered output == direct shared-builder call ----------

// FIXTURE A1 — Full settings
{
  const settings = {
    companyName: "Acme Cleaning",
    seoDescription: "Reliable",
    seoCanonicalUrl: "https://acme.com",
    companyEmail: "hi@acme.com",
    companyPhone: "+1-555-0100",
    companyAddress: "1 Main",
    ogImage: "https://acme.com/og.png",
    ogSiteName: "Acme",
    industry: "Cleaning",
    schemaLocalBusiness: {},
  };
  const rendered = injectSeoMeta(TEMPLATE, settings, REQ);
  const renderedBody = extractJsonLdBody(rendered);
  const canonical = expectedCanonical(settings, REQ);
  const expected = JSON.stringify(buildLocalBusinessSchema(settingsForSchema(settings, REQ), canonical));
  assert.equal(canon(renderedBody), canon(expected), "A1: rendered JSON-LD must equal direct shared-builder call");
  const parsed = JSON.parse(renderedBody);
  assert.equal(parsed["@type"], "LocalBusiness", "A1: @type=LocalBusiness");
  assert.equal(parsed.name, "Acme Cleaning", "A1: name === companyName");
  assert.equal(parsed.email, "hi@acme.com", "A1: email present");
  console.log("PASS fixture-A1 — full settings; server output matches shared builder");
}

// FIXTURE A2 — Null settings → ultimate fallback
{
  const rendered = injectSeoMeta(TEMPLATE, null, REQ);
  const renderedBody = extractJsonLdBody(rendered);
  const canonical = expectedCanonical(null, REQ);
  const expected = JSON.stringify(buildLocalBusinessSchema(null, canonical));
  assert.equal(canon(renderedBody), canon(expected), "A2: null-settings rendered output matches direct call");
  const parsed = JSON.parse(renderedBody);
  assert.equal(parsed["@type"], "LocalBusiness", "A2: @type=LocalBusiness");
  assert.equal(parsed.name, "Local Business", "A2: ultimate fallback name");
  console.log("PASS fixture-A2 — null settings; server output matches shared builder");
}

// FIXTURE A3 — Admin override via schemaLocalBusiness JSONB (D-10 + D-09)
{
  const settings = {
    companyName: "Original",
    seoCanonicalUrl: "https://x.com",
    schemaLocalBusiness: {
      name: "Override Co",
      priceRange: "$$$",
      openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: "Mo" },
    },
  };
  const rendered = injectSeoMeta(TEMPLATE, settings, REQ);
  const renderedBody = extractJsonLdBody(rendered);
  const canonical = expectedCanonical(settings, REQ);
  const expected = JSON.stringify(buildLocalBusinessSchema(settingsForSchema(settings, REQ), canonical));
  assert.equal(canon(renderedBody), canon(expected), "A3: JSONB-override rendered output matches direct call");
  const parsed = JSON.parse(renderedBody);
  assert.equal(parsed.name, "Override Co", "A3: admin name override (D-10)");
  assert.equal(parsed.priceRange, "$$$", "A3: priceRange merged");
  assert.equal(parsed.openingHoursSpecification.dayOfWeek, "Mo", "A3: nested object merged");
  console.log("PASS fixture-A3 — JSONB admin overrides; server output matches shared builder");
}

// ---------- ASSERTION (B): client/src/hooks/use-seo.ts has no inline schema literal ----------

{
  const useSeoPath = path.resolve("client/src/hooks/use-seo.ts");
  const source = fs.readFileSync(useSeoPath, "utf8");

  // Hard regression guard: an inline schema-builder would have a literal `"@type": "LocalBusiness"` substring.
  // The post-refactor file delegates everything to buildLocalBusinessSchema so this substring must NOT appear.
  assert.ok(
    !source.includes('"@type": "LocalBusiness"'),
    'B: client hook contains literal `"@type": "LocalBusiness"` — duplicate inline schema-builder reintroduced!'
  );
  // Also forbid the un-spaced form some formatters produce.
  assert.ok(
    !source.includes('"@type":"LocalBusiness"'),
    'B: client hook contains compact `"@type":"LocalBusiness"` — duplicate inline schema-builder reintroduced!'
  );

  // Positive guard: the file MUST import / call the shared builder.
  assert.ok(
    source.includes("buildLocalBusinessSchema"),
    "B: client hook does not reference buildLocalBusinessSchema — refactor was reverted?"
  );
  console.log("PASS guard-B — client hook delegates to shared builder; no inline schema literal");
}

console.log("\nAll jsonld-parity.test.mjs assertions PASSED.");
console.log("Real browser-side parity (view-source vs after-hydration) requires re-running");
console.log("tests/seo/curl-checks.sh after this plan ships. Pitfall 8 is closed by construction:");
console.log("client and server both call the same shared function on the same input.");
