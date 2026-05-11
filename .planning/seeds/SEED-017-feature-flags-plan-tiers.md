---
id: SEED-017
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao definir planos de assinatura com features diferentes (Basic vs Pro vs Enterprise)
scope: Medium
---

# SEED-017: Feature flags por plano/tier de assinatura

## Why This Matters

Para vender o produto em múltiplos preços, algumas features precisam ser restritas por plano: GHL integration só no Pro, marketing attribution só no Enterprise, número de staff limitado no Basic. Sem feature flags, todos os tenants têm acesso a tudo — impossível diferenciar planos de preço.

**Why:** Feature flags são o mecanismo que transforma "produto único" em "produto com planos de preço" — fundamental para o modelo SaaS.

## When to Surface

**Trigger:** ao definir os planos de assinatura (SEED-014), ou quando o primeiro tenant pedir acesso a uma feature que não está no plano deles.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de billing / planos (conjunto com SEED-014)
- Milestone de multi-tenant (conjunto com SEED-013)
- Ao definir a estratégia de produto por preço

## Scope Estimate

**Medium** — Uma fase. Schema: tabela `planFeatures` (plan, featureKey, enabled, limit). Backend: middleware `requireFeature('ghl_integration')` que verifica o plano do tenant. Frontend: componente `<FeatureGate feature="marketing_dashboard">` que esconde seções do admin quando o plano não tem acesso. Admin: banner de upgrade quando tenant tenta acessar feature restrita.

## Breadcrumbs

- `server/middleware/auth.ts` — pattern de middleware de guarda — feature guard seguiria o mesmo padrão
- `client/src/components/admin/` — seções do admin que seriam guardadas (MarketingSection, IntegrationsSection)
- `shared/schema.ts` — nova tabela `planFeatures` + extend `tenantSubscriptions` (de SEED-014) com `plan` enum
- Features candidatas a flags: `ghl_integration`, `marketing_dashboard`, `ai_chat`, `blog_generation`, `stripe_payments`, `staff_count_limit`

## Notes

Começar com feature flags simples (boolean por plano), não com flags dinâmicas por tenant (LaunchDarkly-style). A complexidade de feature flags dinâmicas não se justifica até ter dezenas de tenants com configurações individuais.
