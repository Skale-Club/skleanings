#!/usr/bin/env bash
# tests/seo/curl-checks.sh — SEO-01..05 verification against a running server.
# Usage: BASE_URL=http://localhost:5000 bash tests/seo/curl-checks.sh
set -u
BASE_URL="${BASE_URL:-http://localhost:5000}"
PASS=0
FAIL=0

fail() { echo "FAIL: $1" >&2; FAIL=$((FAIL+1)); }
pass() { echo "PASS: $1";              PASS=$((PASS+1)); }

HTML="$(curl -s -f "$BASE_URL/" || true)"
if [ -z "$HTML" ]; then
  echo "ERROR: server not reachable at $BASE_URL/ (or returned non-2xx). Start it with: npm run dev" >&2
  exit 2
fi

# SEO-01: <title> non-empty, no "Skleanings" literal
title="$(printf %s "$HTML" | grep -oE '<title>[^<]+</title>' | head -1)"
if [ -z "$title" ]; then
  fail "SEO-01: <title> not found or empty"
elif printf %s "$title" | grep -qi 'skleanings'; then
  fail "SEO-01: <title> still contains literal 'Skleanings' — server-side injection not active"
else
  pass "SEO-01: <title> populated ($title)"
fi

# SEO-02: og:title, og:description, og:image (if present), og:url, link canonical
# Note: og:image may be ABSENT entirely on empty-ogImage tenants (D-07) — count canonical + og:title|description|url.
og_count="$(printf %s "$HTML" | grep -cE 'property="og:(title|description|url)"|rel="canonical"')"
if [ "$og_count" -lt 4 ]; then
  fail "SEO-02: expected >=4 og:title|description|url + canonical tags, found $og_count"
else
  pass "SEO-02: og:* + canonical present ($og_count tags)"
fi

# SEO-03: twitter:card, twitter:title, twitter:description
tw_count="$(printf %s "$HTML" | grep -cE 'name="twitter:(card|title|description)"')"
if [ "$tw_count" -lt 3 ]; then
  fail "SEO-03: expected >=3 twitter:* tags, found $tw_count"
else
  pass "SEO-03: twitter:* present ($tw_count tags)"
fi

# SEO-04: JSON-LD LocalBusiness with name === companySettings.companyName (or industry fallback if companyName empty).
# Step 1: fetch /api/company-settings to determine the EXPECTED name.
SETTINGS_JSON="$(curl -s -f "$BASE_URL/api/company-settings" || true)"
if [ -z "$SETTINGS_JSON" ]; then
  fail "SEO-04: could not fetch /api/company-settings to determine expected name"
else
  # Extract companyName (best-effort grep — accepts string or null). If empty/null/missing, expected="" and the
  # check-jsonld.mjs helper will accept any non-empty schema.name (industry-fallback path documented in D-07).
  EXPECTED_NAME="$(printf %s "$SETTINGS_JSON" | node -e "let h='';process.stdin.on('data',d=>h+=d).on('end',()=>{try{const o=JSON.parse(h);process.stdout.write(o.companyName||'');}catch(e){process.stdout.write('');}})")"
  jsonld_check="$(printf %s "$HTML" | node tests/seo/check-jsonld.mjs "$EXPECTED_NAME")"
  case "$jsonld_check" in
    OK:*) pass "SEO-04: JSON-LD LocalBusiness name=companyName ($jsonld_check; expected=\"$EXPECTED_NAME\")" ;;
    *)    fail "SEO-04: JSON-LD invalid or name mismatch ($jsonld_check; expected=\"$EXPECTED_NAME\")" ;;
  esac
fi

# SEO-05: no "Skleanings" in client/index.html source
sk_count="$(grep -ci skleanings client/index.html || true)"
if [ "$sk_count" -ne 0 ]; then
  fail "SEO-05: client/index.html still contains 'Skleanings' ($sk_count matches)"
else
  pass "SEO-05: client/index.html free of 'Skleanings'"
fi

echo
echo "Summary: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
