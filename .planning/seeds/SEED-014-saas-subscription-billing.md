---
id: SEED-014
status: dormant
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao iniciar o modelo SaaS Xkedule com múltiplos tenants pagantes
scope: Large
---

# SEED-014: Billing Xkedule → Tenants (planos configuráveis no super-admin)

## Why This Matters

A Xkedule precisa cobrar mensalidade dos tenants (empresas que usam a plataforma). Isso é separado do billing tenant→customer (SEED-032) — aqui é a Xkedule recebendo de cada empresa cliente.

**Princípio fundamental:** Os planos não podem ser hardcoded no código. Tudo (nome do plano, preço, features incluídas, limites) deve ser CRUD'ável no super-admin. Quando a Xkedule decidir lançar um plano "Pro Plus" amanhã, é uma operação de UI no super-admin — não um deploy.

**Why:** Planos hardcoded engessam o produto. Cada mudança de preço, novo tier, ou ajuste de feature por plano vira um deploy. Com planos como dado no banco, o time de produto/comercial ajusta sem depender de engenharia.

## When to Surface

**Trigger:** ao assinar o segundo tenant pago, ou ao definir tiers de plano, ou junto com SEED-013 (multi-tenancy) — billing é parte do mesmo milestone de SaaS.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de SaaS Xkedule / monetização
- Conjunto com SEED-013 (multi-tenant) e SEED-015 (super-admin)
- Conjunto com SEED-017 (feature flags) — planos + features são CRUD juntos

## Scope Estimate

**Large** — Uma fase completa. Componentes:

1. **Schema:**
   - `plans` (id, slug, name, description, monthlyPrice, yearlyPrice, stripeProductId, stripePriceIdMonthly, stripePriceIdYearly, isPublic, isActive, order) — CRUD no super-admin
   - `planFeatures` (planId, featureKey, enabled, limit) — quais features cada plano libera + limites (ver SEED-017)
   - `tenantSubscriptions` (tenantId, planId, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd, trialEndsAt, cancelAtPeriodEnd)

2. **Backend:**
   - Webhook handler para eventos Stripe (`invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`)
   - Middleware `requireActiveSubscription` que bloqueia acesso se subscription cancelada/inadimplente
   - Service que sincroniza criação de plano no banco → criação de Product+Price no Stripe via API

3. **Super-admin UI:**
   - CRUD de planos (nome, preço, features, limites)
   - Lista de subscriptions ativas/canceladas/em trial
   - Forçar cancelamento, aplicar crédito, alterar plano de um tenant

4. **Admin do tenant:**
   - Página "Billing & Plan" — ver plano atual, fazer upgrade/downgrade, ver invoices, atualizar payment method
   - Banner de "Trial expira em N dias" / "Pagamento falhou — atualize seu cartão"

## Breadcrumbs

- `server/routes/payments.ts` — padrão existente de Stripe checkout — extensível para subscriptions
- `shared/schema.ts` — novas tabelas `plans`, `planFeatures`, `tenantSubscriptions` — TODAS sem `tenantId` (são globais Xkedule), exceto `tenantSubscriptions` que tem `tenantId`
- Stripe SDK: `stripe.products.create`, `stripe.prices.create`, `stripe.subscriptions.create`, `stripe.checkout.sessions.create(mode: 'subscription')`
- Eventos críticos: `customer.subscription.updated`, `invoice.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.trial_will_end`
- Conta Stripe usada: **conta Xkedule** (não a do tenant) — completamente separada do SEED-032 (Stripe Connect dos tenants)

## Notes

**Trial gratuito** de 14 dias é configurável por plano (`trialDays` em `plans`). Pode ser zero (sem trial) ou customizado por plano.

**Sincronização Stripe:** Ao criar/editar um plano no super-admin, sincroniza com Stripe Products & Prices via API. Se o preço muda, NÃO atualizar o Price existente (Stripe não permite) — criar um novo Price e marcar o antigo como inativo, mantendo tenants antigos no preço antigo (grandfathering).

**Inadimplência:** Após 3 falhas de pagamento, marcar subscription como `past_due`, depois `unpaid`. Aplicar política configurável: bloquear acesso completo, modo read-only, ou apenas banner de aviso.

**Anti-pattern a evitar:** Hardcoded `const PLANS = { basic: {...}, pro: {...} }` no código. Tudo via banco + super-admin UI.
