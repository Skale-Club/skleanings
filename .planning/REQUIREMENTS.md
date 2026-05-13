# Requirements — v8.0 Multi-Tenant Architecture

**Milestone:** v8.0 Multi-Tenant Architecture
**Goal:** Transformar Skleanings em plataforma SaaS multi-tenant com isolamento completo de dados por tenantId, resolução de tenant por hostname e infra config pronta para Hetzner.
**Status:** Active

---

## Milestone Requirements

### Schema Foundation (Phase 38)

- [x] **MT-01**: Tabela `tenants` criada (id serial PK, name text, slug text unique, status text default 'active', createdAt timestamp)
- [x] **MT-02**: Tabela `domains` criada (id serial PK, tenantId FK → tenants.id, hostname text unique, isPrimary boolean default false)
- [x] **MT-03**: Tabela `userTenants` criada (userId FK → users.id, tenantId FK → tenants.id, role text, PK composto)
- [x] **MT-04**: `tenantId INTEGER NOT NULL DEFAULT 1` adicionado a todas as tabelas de negócio (38 tabelas) via migration Supabase
- [x] **MT-05**: Skleanings seeded como tenant id=1 (INSERT INTO tenants), domínio localhost inserido em domains, todos os dados existentes têm tenantId=1 (via DEFAULT 1 na migration)

### Storage Refactor (Phase 39)

- [ ] **MT-06**: `DatabaseStorage` refatorado para `DatabaseStorage.forTenant(tenantId: number)` — retorna instância com todas as queries filtradas por `WHERE tenant_id = tenantId`
- [ ] **MT-07**: Todos os métodos de storage que lêem ou escrevem dados de negócio incluem o filtro de tenantId automaticamente — nenhuma query de negócio fica sem o filtro
- [ ] **MT-08**: Storage singleton existente (`export const storage`) mantido como `storage.forTenant(1)` para compatibilidade durante a transição

### Tenant Resolution Middleware (Phase 40)

- [ ] **MT-09**: `resolveTenantMiddleware` lê `X-Forwarded-Host` (fallback: `Host`), busca no cache LRU, depois na tabela `domains`, e anexa `res.locals.tenant` + `res.locals.storage` à request
- [ ] **MT-10**: Cache LRU de 500 entradas com TTL de 5 minutos para resolução de tenant (sem hit na DB a cada request)
- [ ] **MT-11**: `requireTenantMiddleware` retorna 404 se `res.locals.tenant` não foi resolvido (hostname desconhecido)
- [ ] **MT-12**: Todas as rotas de negócio usam `res.locals.storage` em vez do singleton `storage`
- [ ] **MT-13**: Rotas de super-admin (`/api/super-admin/*`) EXCLUÍDAS do tenant resolution — operam no DB global diretamente

### Infra Config (Phase 41)

- [ ] **MT-14**: `infra/Caddyfile` criado com reverse proxy multi-tenant (wildcard `*.xkedule.com` + domínios customizados por tenant)
- [ ] **MT-15**: `infra/app.service` criado (systemd unit para PM2 ou Node direto no Hetzner)
- [ ] **MT-16**: `.github/workflows/deploy.yml` criado com SSH deploy para Hetzner VM (não ativo — trigger manual)
- [ ] **MT-17**: `infra/README.md` com instruções de setup do servidor Hetzner CX23 (Node install, PM2, Caddy, Cloudflare DNS)

---

## Future Requirements

- Deployment efetivo para Hetzner (DNS cutover) — v9.0
- Tenant onboarding wizard (SEED-018) — v9.0 ou v10.0
- SaaS billing por tenant (SEED-014) — requer multi-tenant ativo
- Custom domain routing por tenant (SEED-016) — infra pronta no MT-14

## Out of Scope

- DNS cutover e deploy real para Hetzner — apenas config files neste milestone
- Tenant UI de self-service (SEED-018) — milestone posterior
- Billing de tenants (SEED-014) — milestone posterior
- pg-boss ou filas distribuídas — arquitetura atual (calendarSyncQueue) continua

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| MT-01 | Phase 38 | Complete |
| MT-02 | Phase 38 | Complete |
| MT-03 | Phase 38 | Complete |
| MT-04 | Phase 38 | Complete |
| MT-05 | Phase 38 | Complete |
| MT-06 | Phase 39 | Pending |
| MT-07 | Phase 39 | Pending |
| MT-08 | Phase 39 | Pending |
| MT-09 | Phase 40 | Pending |
| MT-10 | Phase 40 | Pending |
| MT-11 | Phase 40 | Pending |
| MT-12 | Phase 40 | Pending |
| MT-13 | Phase 40 | Pending |
| MT-14 | Phase 41 | Pending |
| MT-15 | Phase 41 | Pending |
| MT-16 | Phase 41 | Pending |
| MT-17 | Phase 41 | Pending |
