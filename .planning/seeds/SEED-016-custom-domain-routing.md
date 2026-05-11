---
id: SEED-016
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when the first tenant wants their own domain (e.g., booking.cleanco.com)
scope: Medium
---

# SEED-016: Custom domain routing per tenant

## Why This Matters

Today each tenant needs a separate deploy to have their own domain. In a multi-tenant SaaS model, a single deploy must serve `booking.cleanco-a.com` and `booking.cleanco-b.com` — resolving the correct tenant by parsing the `Host` header on every request.

The `skaleclub-websites` already does this in production (50+ tenants, each on their own domain). Pattern to copy:
- Cloudflare SaaS handles DNS + TLS for tenant custom domains
- Caddy reverse proxy terminates TLS, sets `X-Forwarded-Host`
- Express middleware resolves tenant by hostname (LRU cached, 500 entries, 5min TTL)
- `domains` table maps `hostname → tenantId`

**Why:** Custom domains are a baseline requirement of any credible white-label product. The client needs bookings to show up on THEIR domain, not on `xkedule.app/tenant-x`.

## When to Surface

**Trigger:** when the first tenant requests their own domain, or when starting SEED-013 (multi-tenant architecture) — custom domains are part of the multi-tenant package.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Multi-tenant milestone (prerequisite: SEED-013)
- Advanced white-label milestone
- When having 2+ tenants each with their own domain

## Scope Estimate

**Medium** — One phase. Copy the skaleclub-websites pattern:

1. `domains` table (tenantId, hostname, isPrimary, status, provisioningStrategy, caddyConfPath)
2. `resolveTenantMiddleware` reading `X-Forwarded-Host`
3. Caddy snippet template that gets dropped into `/etc/caddy/conf.d/{tenant}.conf` when a domain is added
4. Cloudflare SaaS API integration to add custom hostnames programmatically
5. DNS setup guide for tenants (CNAME or A record to Xkedule's edge)

## Breadcrumbs

- Reference: `skaleclub-websites` `infra/Caddyfile` + `server/middleware/resolveTenant.ts`
- `shared/schema.ts` — new `domains` table (copy from skaleclub-websites)
- `server/index.ts` — middleware registration point — tenant resolver is the first middleware
- New: `infra/templates/tenant-domain.caddy.tmpl` — Caddy config template per tenant
- Cloudflare SaaS docs: custom hostnames API for programmatic domain addition

## Notes

For SSL: Cloudflare SaaS provisions free Let's Encrypt certs for each custom hostname automatically. Caddy can also do per-domain Let's Encrypt as a fallback. The skaleclub-websites uses both strategies — `provisioningStrategy: 'cloudflare_origin_ca' | 'letsencrypt'` per domain.

The tenant resolution middleware MUST be the first middleware registered, before any authentication — auth context depends on tenant context.
