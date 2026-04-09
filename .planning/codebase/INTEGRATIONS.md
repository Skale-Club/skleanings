# External Integrations

**Analysis Date:** 2026-04-04

## Databases

**PostgreSQL:**
- Connection: `DATABASE_URL`, `POSTGRES_URL`, or `POSTGRES_URL_NON_POOLING` env vars
- Client: Drizzle ORM with pg driver
- Session store: connect-pg-simple
- Supports Supabase pooler and direct connections
- SSL: Required (rejectUnauthorized: false)

## Authentication & Identity

**Custom Authentication:**
- Implementation: Passport.js with local strategy
- Password hashing: bcrypt
- Session: express-session with memorystore for dev, PostgreSQL for production

**Supabase Auth:**
- Client: @supabase/supabase-js
- Used for: Client-side authentication
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Payments

**Stripe:**
- Integration: Stripe Connect (multi-tenant)
- SDK: stripe 21.0.1
- Features:
  - Checkout sessions
  - Webhook verification
  - OAuth flow for connected accounts
- Env vars:
  - `STRIPE_CLIENT_ID` - Platform client ID
  - `STRIPE_SECRET_KEY` - Platform secret key
  - Per-company: stored in `integration_settings` table

## Communications

**Twilio (SMS):**
- SDK: twilio 5.11.2
- Features:
  - Booking notifications
  - New chat alerts
  - Calendar disconnect alerts
- Env vars: Per-company configuration (accountSid, authToken, fromPhoneNumber, toPhoneNumbers)

**Telegram:**
- Integration: Bot API (no SDK)
- Features:
  - HTML message formatting
  - Multi-chat broadcast
  - Booking notifications
- Per-company config: botToken, chatIds

## Calendar

**Google Calendar:**
- SDK: google-auth-library
- Features:
  - OAuth2 authentication flow
  - Token refresh
  - Free/busy lookup
  - Staff availability integration
- Env vars: Per-company (clientId, clientSecret stored in integration_settings)
- File: `server/lib/google-calendar.ts`

## CRM & Marketing

**GoHighLevel (GHL):**
- Integration: REST API
- Features:
  - Contact search/create/update
  - Appointment creation
  - Free slot lookup
- Base URL: services.leadconnectorhq.com
- API Version: 2021-04-15 (configurable)
- File: `server/integrations/ghl.ts`

**Thumbtack (Lead Gen):**
- Integration: OAuth2
- Features:
  - Lead ingestion
  - Authorization flow
- Auth URL: auth.thumbtack.com/oauth2/auth
- Token URL: auth.thumbtack.com/oauth2/token
- File: `server/integrations/thumbtack.ts`

## AI & Machine Learning

**OpenAI:**
- SDK: openai 4.104.0
- AI SDK: ai 6.0.116
- React integration: @ai-sdk/react 3.0.118
- Default model: gpt-4o
- Used for: Chat AI, content generation
- Env var: `OPENAI_API_KEY`
- File: `server/lib/openai.ts`

**Google Gemini:**
- SDK: @google/generative-ai 0.24.1
- Used for: AI content generation
- File: `server/lib/gemini.ts`

**OpenRouter:**
- Integration: Alternative AI gateway
- File: `server/lib/openrouter.ts`

## File Storage

**Google Cloud Storage:**
- SDK: @google/cloud/storage 7.18.0
- Usage: File storage for uploads

**AWS S3 (via Uppy):**
- SDK: @uppy/aws-s3 5.1.0
- Upload framework: @uppy/core 5.2.0, @uppy/dashboard 5.2.0
- Used for: Direct-to-S3 uploads

## Analytics & Performance

**Vercel Analytics:**
- SDK: @vercel/analytics 1.6.1
- Usage: Web analytics

**Vercel Speed Insights:**
- SDK: @vercel/speed-insights 1.3.1
- Usage: Performance monitoring

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` - Database connection
- `SESSION_SECRET` - Session encryption key
- `ADMIN_EMAIL` - Admin login email
- `ADMIN_PASSWORD_HASH` - Hashed admin password
- `OPENAI_API_KEY` - OpenAI access
- `STRIPE_CLIENT_ID` - Stripe Connect platform ID
- `STRIPE_SECRET_KEY` - Stripe Connect secret

**Supabase (client):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Per-company settings (stored in database):**
- Integration credentials stored in `integration_settings` table
- Retrieved via `storage.getIntegrationSettings()`

## Webhooks & Callbacks

**Stripe Webhooks:**
- Endpoint: `/webhooks/stripe`
- Verified via: signature validation
- Secret stored in integration_settings

**Outgoing webhooks (by service):**
- GHL: Creates appointments in CRM
- Twilio/Telegram: Sends notifications
- Google Calendar: Syncs availability

## Hosting & Deployment

**Platform:** Vercel
- Evidence: vercel.json, @vercel/* packages, VERCEL env var handling
- Build: Custom script in `script/build.mjs`
- Runtime: @vercel/node

---

*Integration audit: 2026-04-04*
