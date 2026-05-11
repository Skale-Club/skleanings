---
id: SEED-016
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao ter o primeiro tenant que queira seu próprio domínio (ex: booking.limpezaxyz.com)
scope: Medium
---

# SEED-016: Roteamento por domínio customizado por tenant

## Why This Matters

Hoje cada tenant precisa de um deploy separado para ter seu próprio domínio. Em um modelo multi-tenant SaaS, um único deploy precisa servir `booking.empresa-a.com` e `booking.empresa-b.com` — resolvendo o tenant correto pela análise do `Host` header em cada requisição.

**Why:** Domínio próprio é um requisito básico de qualquer white-label credível. O cliente precisa que os bookings apareçam no domínio deles, não em `skleanings.vercel.app/tenant-x`.

## When to Surface

**Trigger:** quando o primeiro tenant pedir domínio próprio, ou ao iniciar SEED-013 (multi-tenant architecture) — domínio customizado é parte do pacote multi-tenant.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de multi-tenant (pré-requisito: SEED-013)
- Milestone de white-label avançado
- Ao ter 2+ tenants cada um com seu próprio domínio

## Scope Estimate

**Medium** — Uma fase. Partes: (1) tabela `tenantDomains` com domínio verificado e tenant ID; (2) middleware Express que lê o `Host` header e resolve o tenant; (3) SSL automático via Vercel/Cloudflare wildcard cert ou Let's Encrypt per-domain; (4) DNS setup guide para tenants.

## Breadcrumbs

- `server/index.ts` — middleware registration point — tenant resolver seria o primeiro middleware
- `vercel.json` — current rewrite rules — precisaria de rewrites por domínio ou uso de Vercel Domains API
- Alternativa: Cloudflare Workers com `request.headers.get('Host')` para resolver tenant antes de chegar no Express
- `shared/schema.ts` — nova tabela `tenantDomains` (`tenantId`, `domain`, `verifiedAt`, `sslStatus`)

## Notes

Vercel tem suporte nativo a custom domains via CLI/API — `vercel domains add booking.empresa-a.com`. Para SSL automático, Vercel provisiona via Let's Encrypt. O middleware de resolução de tenant via Host header é a peça central — deve ser o primeiro middleware registrado, antes de qualquer autenticação.
