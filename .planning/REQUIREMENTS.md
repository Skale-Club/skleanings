# Requirements — v7.0 Xkedule Foundation

**Milestone:** v7.0 Xkedule Foundation
**Goal:** Criar infraestrutura de operação da plataforma (super-admin) e locale settings por tenant.
**Status:** Active

---

## Milestone Requirements

### Super-Admin Panel (SEED-015)

- [ ] **SADM-01**: Rota `/superadmin` acessível apenas com credenciais super-admin (env vars `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD_HASH`) — retorna 403 para qualquer outra sessão
- [ ] **SADM-02**: Painel super-admin exibe stats do tenant atual: total de bookings, total de clientes, total de serviços, número de staff, uptime da DB
- [ ] **SADM-03**: Painel super-admin exibe health check da plataforma: DB conectada, migrações aplicadas (supabase migrations status), variáveis de ambiente obrigatórias presentes
- [ ] **SADM-04**: Super-admin pode ver e editar companySettings do tenant atual (acesso de suporte sem precisar do login de admin do tenant)
- [ ] **SADM-05**: Logs de erros recentes da aplicação (últimos 50 erros de server) visíveis no painel super-admin
- [ ] **SADM-06**: Rotas `/api/super-admin/*` retornam 403 para requests sem cookie de sessão super-admin válido

### Locale Settings Admin (SEED-011)

- [x] **LOC-01**: Admin pode configurar `language` do tenant (opções: `en`, `pt-BR`) na seção General do Company Settings
- [x] **LOC-02**: Admin pode configurar `startOfWeek` (opções: `sunday`, `monday`) — calendário admin reflete a configuração
- [x] **LOC-03**: Admin pode configurar `dateFormat` (opções: `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`)
- [x] **LOC-04**: Configurações de locale persistidas em `companySettings` via migration Supabase
- [ ] **LOC-05**: Booking flow usa `language` e `dateFormat` do tenant para exibição de datas

---

## Future Requirements

- Impersonation (acessar admin de qualquer tenant como suporte) — requer multi-tenant (SEED-013)
- Lista de todos os tenants no super-admin — requer multi-tenant
- Feature flags por plano (SEED-017) — requer planos e multi-tenant (SEED-013 + SEED-014)
- Full i18n do booking flow (SEED-012 — cancelado)

## Out of Scope

- Multi-tenant architecture (SEED-013) — milestone posterior
- IP allowlist para super-admin — usar auth por credenciais por ora
- Tradução de strings do booking flow — SEED-012 cancelado; locale é só para formatação

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| LOC-01 | Phase 36 | — |
| LOC-02 | Phase 36 | — |
| LOC-03 | Phase 36 | — |
| LOC-04 | Phase 36 | — |
| LOC-05 | Phase 36 | — |
| SADM-01 | Phase 37 | — |
| SADM-02 | Phase 37 | — |
| SADM-03 | Phase 37 | — |
| SADM-04 | Phase 37 | — |
| SADM-05 | Phase 37 | — |
| SADM-06 | Phase 37 | — |
