# Requirements — v12.0 SaaS Billing

**Milestone:** v12.0 SaaS Billing
**Goal:** A plataforma cobra uma assinatura mensal por tenant via Stripe — super-admin gerencia planos e vê status de billing, tenant admin vê e gerencia a própria assinatura.
**Status:** Active

---

## Milestone Requirements

### Stripe Subscription Infrastructure (Phase 48)

- [x] **SB-01**: Tabela `tenant_subscriptions` armazena stripeCustomerId, stripeSubscriptionId, status (active/past_due/canceled/trialing), planId, currentPeriodEnd por tenant
- [x] **SB-02**: Na criação de um tenant (POST /api/super-admin/tenants), um Stripe Customer é criado automaticamente e `stripeCustomerId` salvo em `tenant_subscriptions`
- [x] **SB-03**: Super-admin pode iniciar uma assinatura para um tenant (`POST /api/super-admin/tenants/:id/subscribe`) — cria Stripe Subscription com price ID configurável via env var `STRIPE_SAAS_PRICE_ID`
- [ ] **SB-04**: Webhook Stripe (`POST /api/billing/webhook`) processa eventos `customer.subscription.updated` e `customer.subscription.deleted` — atualiza status em `tenant_subscriptions`

### Subscription Enforcement (Phase 49)

- [x] **SB-05**: `resolveTenantMiddleware` verifica status da subscription — tenants com status `canceled` ou `past_due` há mais de 3 dias recebem 402 "Subscription required" antes de qualquer route handler
- [x] **SB-06**: Super-admin vê status de billing (status, planId, currentPeriodEnd) para cada tenant na listagem de tenants

### Tenant Billing Self-Service (Phase 50)

- [ ] **SB-07**: Admin do tenant vê status da própria assinatura em `/admin/billing` — exibe status, data de renovação, e link para Stripe Customer Portal
- [ ] **SB-08**: `POST /api/billing/portal` cria uma Stripe Billing Portal session para o tenant atual e retorna a URL — admin é redirecionado para gerenciar cartão/cancelar

---

## Future Requirements

- Trial period automático na criação de tenant (7-30 dias)
- Múltiplos planos (basic/pro/enterprise) com feature flags
- Dunning emails via Resend quando subscription está past_due
- Invoice history no painel do tenant admin

## Out of Scope

| Feature | Reason |
|---------|--------|
| Self-serve signup com billing | Requer Hetzner provisionado |
| Múltiplos planos com feature flags | v13.0+ após billing básico validado |
| Metered billing por booking | Complexidade desnecessária para MVP |
| Período de trial automático | Simplificação — super-admin inicia assinatura manualmente |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SB-01 | Phase 48 | Complete |
| SB-02 | Phase 48 | Complete |
| SB-03 | Phase 48 | Complete |
| SB-04 | Phase 48 | Pending |
| SB-05 | Phase 49 | Complete |
| SB-06 | Phase 49 | Complete |
| SB-07 | Phase 50 | Pending |
| SB-08 | Phase 50 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 — traceability confirmed, roadmap phases 48–50 created*
