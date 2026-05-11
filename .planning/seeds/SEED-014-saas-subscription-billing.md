---
id: SEED-014
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao iniciar o modelo SaaS com múltiplos tenants pagantes
scope: Large
---

# SEED-014: Billing por assinatura SaaS (Stripe Subscriptions por tenant)

## Why This Matters

Hoje o modelo de negócio do produto é "vender o sistema para uma empresa". Para escalar como SaaS, o modelo precisa ser "cobrar mensalidade por tenant ativo". O Stripe já está integrado para processar pagamentos de clientes finais — precisa ser estendido para processar também a assinatura mensal de cada tenant do sistema.

**Why:** Sem billing automatizado, cada renovação de contrato é manual. Com Stripe Subscriptions, o faturamento dos tenants é automático, com upgrade/downgrade de planos e inadimplência gerenciada pelo Stripe.

## When to Surface

**Trigger:** ao assinar o segundo tenant pago, ou ao definir tiers de plano (Basic, Pro, Enterprise), ou junto com SEED-013 (multi-tenancy).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de SaaS / plataforma
- Milestone de modelo de negócio / monetização
- Conjunto com SEED-013 (multi-tenant) e SEED-015 (super-admin)

## Scope Estimate

**Large** — Uma fase completa. Criar: tabela `tenantSubscriptions` (Stripe customer ID, plan, status, period end), webhook handler para eventos Stripe (invoice.paid, subscription.cancelled, trial_end), middleware de billing guard (bloqueia acesso se subscription expirada), UI de billing no admin do tenant.

## Breadcrumbs

- `server/routes/payments.ts` — padrão existente de Stripe checkout + webhook — extensível para subscriptions
- `server/integrations/ghl.ts` — padrão de integração externa — billing seguiria mesmo padrão
- `shared/schema.ts` — nova tabela `tenantSubscriptions` com `stripeCustomerId`, `stripePriceId`, `status`, `currentPeriodEnd`
- Stripe SDK: `stripe.subscriptions.create`, `stripe.webhooks.constructEvent`
- Eventos críticos: `customer.subscription.updated`, `invoice.payment_failed`, `invoice.payment_succeeded`

## Notes

Definir planos antes de implementar: Basic (até 2 staff, sem GHL), Pro (até 10 staff, GHL incluso), Enterprise (ilimitado, white-label completo). Os feature flags do plano alimentam SEED-017 (feature flags por tier). Trial gratuito de 14 dias para onboarding.
