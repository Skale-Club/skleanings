# Requirements — v18.0 Custom Domain Routing

**Milestone:** v18.0 Custom Domain Routing
**Goal:** Tenant admins can register their own custom domain (e.g. `agendar.minhalimpeza.com`) instead of being limited to `*.xkedule.com` subdomains. DNS verification via TXT record before activation; Caddy on-demand TLS handles certificate issuance automatically.
**Status:** Active

---

## Milestone Requirements

### Custom Domain Backend (Phase 61)

- [x] **CD-01**: `domains` table extended with `verified BOOLEAN DEFAULT false`, `verifiedAt TIMESTAMPTZ`, and `verificationToken TEXT` columns (Supabase migration + Drizzle schema)
- [ ] **CD-02**: `POST /api/admin/domains` (requireAdmin) accepts `{ hostname }`, validates format, generates a random 32-byte hex verification token, inserts `domains` row with `verified=false, isPrimary=false` for the current tenant — returns `{ id, hostname, verificationToken, instructions }` where `instructions` describes the required TXT record at `_xkedule.<hostname>`
- [ ] **CD-03**: `POST /api/admin/domains/:id/verify` (requireAdmin) performs a DNS TXT lookup at `_xkedule.<hostname>` (via Node `dns.promises.resolveTxt`), compares against the stored `verificationToken`, sets `verified=true` and `verifiedAt=now()` on match — returns 200 `{ verified: true }`; mismatch returns 400 `{ verified: false, message }`
- [ ] **CD-04**: `DELETE /api/admin/domains/:id` (requireAdmin) removes a domain — refuses with 409 if `isPrimary=true` (protects the auto-generated subdomain); also invalidates the LRU tenant cache for that hostname
- [ ] **CD-05**: `GET /api/admin/domains` (requireAdmin) returns the current tenant's `domains` rows (id, hostname, isPrimary, verified, verifiedAt, createdAt) — only domains for `res.locals.tenant.id`
- [ ] **CD-06**: `resolveTenantMiddleware` is updated to only accept verified domains for non-primary entries — an unverified custom hostname returns 404 (just like an unknown hostname); the `*.xkedule.com` primary domain bypasses the verification check

### Custom Domain Frontend (Phase 62)

- [ ] **CD-07**: `/admin/settings/domains` page lists the tenant's domains with hostname, status badge (Primary / Verified / Pending Verification), and Remove button — non-primary domains can be removed
- [ ] **CD-08**: "Add Custom Domain" button opens a dialog with a hostname input + DNS instructions panel showing the exact TXT record to add — after the user clicks "Verify", calls `POST /:id/verify` and shows success or specific DNS error
- [ ] **CD-09**: Super-admin Tenants table "Manage Domains" dialog shows all custom domains per tenant with verification status — super-admin can manually remove any domain (including unverified ones)

---

## Future Requirements

- Automatic DNS verification retry (poll every 30s for up to 1 hour)
- ACME challenge-based verification (HTTP-01) as an alternative to TXT
- Domain transfer between tenants
- Wildcard custom domains (e.g. `*.agendar.minhalimpeza.com`)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-retry DNS verification | Manual click sufficient for MVP |
| HTTP-01 challenges | TXT is simpler and matches Cloudflare/AWS patterns |
| Domain transfer | Edge case; manual super-admin action |
| Wildcard custom domains | Niche; v19.0+ if requested |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CD-01 | Phase 61 | Complete |
| CD-02 | Phase 61 | Pending |
| CD-03 | Phase 61 | Pending |
| CD-04 | Phase 61 | Pending |
| CD-05 | Phase 61 | Pending |
| CD-06 | Phase 61 | Pending |
| CD-07 | Phase 62 | Pending |
| CD-08 | Phase 62 | Pending |
| CD-09 | Phase 62 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-15*
