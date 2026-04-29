---
status: partial
phase: 15-schema-foundation-detokenization
source: [15-VERIFICATION.md]
started: 2026-04-29T04:30:00.000Z
updated: 2026-04-29T04:30:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Apply migration to live DB
expected: After `supabase db push`, `psql -c "\d company_settings"` shows three new columns: `service_delivery_model TEXT DEFAULT 'at-customer'`, `privacy_policy_content TEXT DEFAULT ''`, `terms_of_service_content TEXT DEFAULT ''`. Existing rows have correct defaults populated.
result: [pending]

### 2. Browser tab title updates from companyName
expected: With `companyName='TestTenant'` in `company_settings`, hard-reload customer site → browser tab title displays "TestTenant" (not "Skleanings").
result: [pending]

### 3. localStorage visitor key migrates with slug change
expected: Set `companyName='Acme Cleaners'` → reload site → DevTools → Application → localStorage shows key `acme-cleaners_visitor_id`. Change to `companyName='Beta Co'` → reload → key becomes `beta-co_visitor_id`.
result: [pending]

### 4. Privacy and Terms pages render with empty companyName
expected: Set `companyName=''` and `companyEmail=''` in DB → load `/privacy-policy` and `/terms-of-service` → no "Skleanings" string appears anywhere on either page (empty company-name placeholders show nothing rather than "Skleanings").
result: [pending]

### 5. OpenRouter X-Title header reflects companyName
expected: With `companyName='TestTenant'` and `OPENROUTER_APP_TITLE` env unset, trigger blog generation or `/api/integrations/openrouter/test`. Intercept the outbound request to OpenRouter → `X-Title: TestTenant` header present. With both empty, header is omitted (or empty string) — no "Skleanings".
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
