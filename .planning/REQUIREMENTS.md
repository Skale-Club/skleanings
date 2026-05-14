# Requirements — v9.0 Tenant Onboarding

**Milestone:** v9.0 Tenant Onboarding
**Goal:** Super-admin pode criar e configurar novos tenants na plataforma — cada tenant recebe seu domínio, admin próprio e acesso isolado aos seus dados.
**Status:** Active

---

## Milestone Requirements

### Tenant Management — Super-Admin (Phase 42)

- [ ] **TO-01**: Super-admin pode listar todos os tenants com nome, slug, status, domínio primário e data de criação
- [ ] **TO-02**: Super-admin pode criar um novo tenant (nome, slug, domínio primário) via formulário no painel /superadmin
- [ ] **TO-03**: Super-admin pode adicionar e remover domínios extras de um tenant (tabela `domains`)
- [ ] **TO-04**: Super-admin pode ativar ou desativar um tenant (status active/inactive) — tenants inativos recebem 503 no middleware de resolução

### Tenant Provisioning (Phase 43)

- [ ] **TO-05**: Super-admin pode provisionar o admin inicial de um tenant — criar um usuário na tabela `users` com email e senha bcrypt e inserir na `user_tenants` com role='admin'
- [ ] **TO-06**: Ao criar um tenant, company settings padrão são inseridos automaticamente (nome do tenant, fuso horário padrão, locale padrão) para que o booking flow funcione imediatamente
- [ ] **TO-07**: O cache LRU do middleware de resolução é invalidado quando um domínio é adicionado ou removido — nova request resolve o domínio atualizado sem restart do servidor

### Tenant Isolation Verification (Phase 44)

- [ ] **TO-08**: Admin de tenant 2 faz login em seu domínio e vê apenas os dados do tenant 2 — bookings, services, staff e company settings são isolados
- [ ] **TO-09**: Request para um domínio de tenant inativo recebe 503 com mensagem "Tenant temporarily unavailable" antes de atingir qualquer rota de negócio
- [ ] **TO-10**: Super-admin pode visualizar stats por tenant (total bookings, total services, staff count) diretamente no painel de listagem de tenants

---

## Future Requirements

- SaaS billing por tenant (Stripe subscription por tenant) — SEED-014
- Custom domain SSL automatizado via Caddy ACME — requer Hetzner provisionado
- Tenant impersonation (super-admin acessa painel de qualquer tenant) — SEED-016
- Feature flags por plano — SEED-017
- Tenant onboarding wizard para self-serve signup — pós Hetzner

## Out of Scope

| Feature | Reason |
|---------|--------|
| Self-serve signup de tenants | Requer billing e Hetzner provisionado — v10.0 |
| DNS automático | Requer Cloudflare API por tenant — pós migração Hetzner |
| Migração de dados entre tenants | Operação de DBA manual, fora do produto |
| Multi-region por tenant | Infraestrutura única CX23 por ora |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TO-01 | Phase 42 | Pending |
| TO-02 | Phase 42 | Pending |
| TO-03 | Phase 42 | Pending |
| TO-04 | Phase 42 | Pending |
| TO-05 | Phase 43 | Pending |
| TO-06 | Phase 43 | Pending |
| TO-07 | Phase 43 | Pending |
| TO-08 | Phase 44 | Pending |
| TO-09 | Phase 44 | Pending |
| TO-10 | Phase 44 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 — traceability confirmed after roadmap creation*
