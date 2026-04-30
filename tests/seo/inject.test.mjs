// tests/seo/inject.test.mjs — pure-function harness
// Run with: npx tsx tests/seo/inject.test.mjs
import assert from "node:assert/strict";
import { injectSeoMeta, escapeAttr, escapeJsonLd, buildCanonicalUrl } from "../../server/lib/seo-injector.ts";
import { buildLocalBusinessSchema, deepMerge } from "../../shared/seo.ts";

const TEMPLATE = `<!DOCTYPE html><html><head>
  <title>{{SEO_TITLE}}</title>
  <meta name="description" content="{{SEO_DESCRIPTION}}" />
  <link rel="canonical" href="{{CANONICAL_URL}}" />
  <link rel="icon" href="{{FAVICON_URL}}" />
  <meta property="og:title" content="{{SEO_TITLE}}" />
  {{OG_IMAGE_BLOCK}}
  <meta property="og:url" content="{{CANONICAL_URL}}" />
  <meta property="og:site_name" content="{{OG_SITE_NAME}}" />
  <meta name="twitter:card" content="{{TWITTER_CARD}}" />
  <meta name="twitter:title" content="{{SEO_TITLE}}" />
  <meta name="twitter:description" content="{{SEO_DESCRIPTION}}" />
  {{TWITTER_IMAGE_BLOCK}}
  <meta name="robots" content="{{ROBOTS}}" />
  <script type="application/ld+json">{{JSON_LD}}</script>
</head><body></body></html>`;

const REQ = { protocol: "https", host: "tenant.example.com", originalUrl: "/" };

function extractJsonLd(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, "JSON-LD script block not found in output");
  return JSON.parse(m[1]);
}

function rawJsonLdBody(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, "JSON-LD script block not found in output");
  return m[1];
}

// CASE 1 — Full settings: all tokens replaced
{
  const settings = {
    companyName: "Acme Cleaning",
    seoTitle: "Acme Cleaning | Top-Rated",
    seoDescription: "Reliable cleaning",
    seoCanonicalUrl: "https://acme.com",
    ogImage: "https://acme.com/og.png",
    ogType: "website",
    ogSiteName: "Acme",
    twitterCard: "summary_large_image",
    twitterSite: "@acme",
    twitterCreator: "@acmeceo",
    seoRobotsTag: "index, follow",
    industry: "Cleaning",
    companyEmail: "hi@acme.com",
    companyPhone: "+1-555-0100",
    companyAddress: "1 Main St",
    schemaLocalBusiness: {},
  };
  const out = injectSeoMeta(TEMPLATE, settings, REQ);
  assert.ok(out.includes("<title>Acme Cleaning | Top-Rated</title>"), "case1: seoTitle in <title>");
  assert.ok(!out.includes("{{"), "case1: no unreplaced token markers");
  const jsonLd = extractJsonLd(out);
  assert.equal(jsonLd["@type"], "LocalBusiness");
  assert.equal(jsonLd.name, "Acme Cleaning");
  assert.equal(jsonLd.email, "hi@acme.com");
  console.log("PASS case1 — full settings");
}

// CASE 2 — null settings → industry fallback
{
  const out = injectSeoMeta(TEMPLATE, null, REQ);
  assert.ok(!out.includes("<title></title>"), "case2: <title> not empty");
  assert.ok(!out.includes("{{"), "case2: no unreplaced markers");
  const jsonLd = extractJsonLd(out);
  assert.equal(jsonLd["@type"], "LocalBusiness");
  assert.ok(jsonLd.name && jsonLd.name.length > 0, "case2: schema.name non-empty");
  console.log("PASS case2 — null settings → fallback");
}

// CASE 3 — Empty canonical → req-derived
{
  const settings = { seoCanonicalUrl: "", companyName: "X", schemaLocalBusiness: {} };
  const req = { protocol: "https", host: "x.com", originalUrl: "/foo" };
  const out = injectSeoMeta(TEMPLATE, settings, req);
  assert.ok(out.includes('href="https://x.com/foo"'), "case3: canonical from req");
  console.log("PASS case3 — req-derived canonical");
}

// CASE 4 — schemaLocalBusiness JSONB merge with name override
{
  const settings = {
    companyName: "Original",
    schemaLocalBusiness: { priceRange: "$$$", name: "Override Name", sameAs: ["https://twitter.com/x"] },
  };
  const out = injectSeoMeta(TEMPLATE, settings, REQ);
  const jsonLd = extractJsonLd(out);
  assert.equal(jsonLd.priceRange, "$$$", "case4: priceRange merged");
  assert.equal(jsonLd.name, "Override Name", "case4: admin name override (D-10)");
  assert.deepEqual(jsonLd.sameAs, ["https://twitter.com/x"], "case4: array merged");
  console.log("PASS case4 — JSONB merge with override");
}

// CASE 5a — HTML attribute escape (XSS via seoTitle)
{
  // seoTitle flows ONLY into <title> and into the og:title / twitter:title attribute content.
  // Assert the rendered HTML contains the escaped attribute form AND not the literal payload.
  const malicious = `</script><script>alert(1)`;
  const settings = { seoTitle: malicious, companyName: "x", schemaLocalBusiness: {} };
  const out = injectSeoMeta(TEMPLATE, settings, REQ);
  const escaped = "&lt;/script&gt;&lt;script&gt;alert(1)";
  // Inside <title>...</title>:
  const titleMatch = out.match(/<title>([\s\S]*?)<\/title>/);
  assert.ok(titleMatch, "case5a: <title> present");
  assert.ok(titleMatch[1].includes(escaped), "case5a: escaped form inside <title>");
  // Inside og:title content:
  assert.ok(
    out.includes(`property="og:title" content="${escaped}"`),
    "case5a: escaped form inside og:title content"
  );
  // Inside twitter:title content:
  assert.ok(
    out.includes(`name="twitter:title" content="${escaped}"`),
    "case5a: escaped form inside twitter:title content"
  );
  // Negative assertion: the literal unescaped payload must not appear ANYWHERE in the rendered HTML.
  assert.ok(
    !out.includes(`</script><script>alert(1)`),
    "case5a: literal unescaped payload absent (proves attribute was escaped)"
  );
  console.log("PASS case5a — HTML attribute escape");
}

// CASE 5b — JSON-LD escape (XSS via companyName, which DOES flow into the JSON-LD body via schema.name)
{
  const malicious = `</script><script>alert(1)</script>`;
  const settings = { companyName: malicious, schemaLocalBusiness: {} };
  const out = injectSeoMeta(TEMPLATE, settings, REQ);
  const ldBody = rawJsonLdBody(out);
  // Negative: literal </script> must NOT appear inside the JSON-LD body (would break out of <script>).
  assert.ok(!ldBody.includes("</script>"), "case5b: no literal </script> inside JSON-LD body");
  // Positive: the escaped form <\/script> MUST appear (escapeJsonLd's job).
  assert.ok(ldBody.includes("<\\/script>"), "case5b: escaped <\\/script> form present");
  // Round-trip: JSON.parse must succeed and recover the ORIGINAL value (escape is syntactic, not semantic).
  const parsed = JSON.parse(ldBody);
  assert.equal(
    parsed.name,
    malicious,
    "case5b: parsed name equals original un-escaped string (escape is purely syntactic)"
  );
  console.log("PASS case5b — JSON-LD escape");
}

// CASE 6 — og:image relative → absolutized in BOTH og:image attr (block-emitted) and JSON-LD image
{
  const settings = { ogImage: "/assets/logo.png", companyName: "X", schemaLocalBusiness: {} };
  const req = { protocol: "https", host: "x.com", originalUrl: "/" };
  const out = injectSeoMeta(TEMPLATE, settings, req);
  assert.ok(
    out.includes('property="og:image" content="https://x.com/assets/logo.png"'),
    "case6: og:image absolutized (block-emitted)"
  );
  assert.ok(
    out.includes('property="og:image:alt"'),
    "case6: og:image:alt block-emitted alongside og:image"
  );
  assert.ok(
    out.includes('name="twitter:image" content="https://x.com/assets/logo.png"'),
    "case6: twitter:image absolutized (block-emitted)"
  );
  const jsonLd = extractJsonLd(out);
  assert.equal(jsonLd.image, "https://x.com/assets/logo.png", "case6: schema.image absolutized");
  console.log("PASS case6 — og:image absolutification");
}

// CASE 7 — D-07: ogImage empty → og:image / twitter:image clusters fully OMITTED
{
  const settings = { ogImage: "", companyName: "X", schemaLocalBusiness: {} };
  const out = injectSeoMeta(TEMPLATE, settings, REQ);
  assert.ok(
    !out.includes("og:image"),
    "case7: NO og:image substring in rendered HTML when ogImage empty (D-07)"
  );
  assert.ok(
    !out.includes("twitter:image"),
    "case7: NO twitter:image substring in rendered HTML when ogImage empty (D-07)"
  );
  // Sanity: tokens still all replaced (no leftover {{...}} markers).
  assert.ok(!out.includes("{{"), "case7: no unreplaced markers (block-tokens correctly emit empty string)");
  console.log("PASS case7 — D-07 conditional emit (absent on empty)");
}

// CASE FAV-02 — faviconUrl set: token expands to custom URL
{
  const settings = {
    companyName: "Acme",
    faviconUrl: "https://cdn.example.com/favicon.ico",
  };
  const out = injectSeoMeta(TEMPLATE, settings, REQ);
  assert.ok(
    out.includes('href="https://cdn.example.com/favicon.ico"'),
    `FAV-02: expected custom faviconUrl in href, got: ${out.match(/link rel="icon"[^>]*/)?.[0]}`
  );
  console.log("PASS: FAV-02 — faviconUrl set → custom URL in favicon href");
}

// CASE FAV-03 — faviconUrl empty: token falls back to /favicon.png
{
  const settings = {
    companyName: "Acme",
    faviconUrl: "",
  };
  const out = injectSeoMeta(TEMPLATE, settings, REQ);
  assert.ok(
    out.includes('href="/favicon.png"'),
    `FAV-03: expected /favicon.png fallback in href, got: ${out.match(/link rel="icon"[^>]*/)?.[0]}`
  );
  console.log("PASS: FAV-03 — faviconUrl empty → /favicon.png fallback");
}

// CASE FAV-03b — faviconUrl null: token falls back to /favicon.png
{
  const settings = {
    companyName: "Acme",
    faviconUrl: null,
  };
  const out = injectSeoMeta(TEMPLATE, settings, REQ);
  assert.ok(
    out.includes('href="/favicon.png"'),
    `FAV-03b: expected /favicon.png fallback for null faviconUrl, got: ${out.match(/link rel="icon"[^>]*/)?.[0]}`
  );
  console.log("PASS: FAV-03b — faviconUrl null → /favicon.png fallback");
}

console.log("\nAll inject.test.mjs cases PASSED.");
