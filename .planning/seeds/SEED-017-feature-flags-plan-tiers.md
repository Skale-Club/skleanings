---
id: SEED-017
status: dormant
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao definir planos de assinatura (conjunto com SEED-014)
scope: Medium
---

# SEED-017: Features e limites por plano (tudo CRUD no super-admin, nada hardcoded)

## Why This Matters

Cada plano tem um conjunto de features liberadas e limites quantitativos. Exemplos:
- Basic: blog ❌, GHL ❌, marketing dashboard ❌, máx 2 staff, máx 100 bookings/mês
- Pro: blog ✓, GHL ✓, marketing dashboard ✓, máx 10 staff, máx 1000 bookings/mês
- Enterprise: tudo liberado, ilimitado

**Princípio fundamental:** Nem as features, nem os limites podem ser hardcoded. O super-admin precisa poder criar uma nova feature ("AI suggestions") amanhã, ativar para Enterprise, e ter o sistema respeitando isso sem deploy.

**Why:** Hardcoded feature flags transformam cada decisão de produto em mudança de código. Com CRUD no super-admin, o time de produto define a matriz "plano × feature × limite" como dado.

## When to Surface

**Trigger:** junto com SEED-014 (billing) e SEED-013 (multi-tenant). Os três formam o núcleo do SaaS.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de SaaS Xkedule (conjunto com SEED-013 + SEED-014)
- Milestone de monetização / pricing strategy
- Quando precisar diferenciar planos por feature

## Scope Estimate

**Medium** — Uma fase. Componentes:

1. **Schema:**
   - `features` (id, key, name, description, type enum: `boolean | numeric | enum`, defaultValue) — catálogo global de features que existem no produto
   - `planFeatures` (planId FK, featureId FK, enabled, limitValue) — matriz plano × feature
   - `featureUsage` (tenantId FK, featureKey, periodStart, periodEnd, currentValue) — para limites com janela (ex: bookings/mês)

2. **Backend:**
   - Middleware `requireFeature(key)` que verifica se o plano do tenant tem a feature
   - Middleware `enforceFeatureLimit(key)` que verifica e incrementa contadores (bookings, staff count, storage)
   - Service `getEnabledFeatures(tenantId)` cacheado (5min TTL)

3. **Frontend:**
   - Componente `<FeatureGate feature="ghl_integration">` que esconde/desabilita seções do admin
   - Hook `useFeature(key)` que retorna `{ enabled, limit, current, remaining }`
   - Banner de upgrade quando tenant atinge limite ou tenta acessar feature bloqueada

4. **Super-admin UI:**
   - CRUD do catálogo de features (criar nova feature, definir tipo, default)
   - Matriz visual "plano × feature" com toggles e campos de limite
   - Auditoria: log de quais tenants atingiram limites no último mês

## Breadcrumbs

- `server/middleware/auth.ts` — pattern de middleware de guarda — feature guard segue o mesmo padrão
- `client/src/components/admin/` — seções a serem guardadas: `MarketingSection`, `IntegrationsSection`, `BlogSection`
- Schema novo: `features`, `planFeatures`, `featureUsage` — todos no nível Xkedule (sem `tenantId` exceto `featureUsage`)
- Lookup: tenant → subscription → plan → planFeatures — cacheado por request

## Notes

**Tipos de feature:**
- `boolean` — on/off (ex: `ghl_integration`, `marketing_dashboard`, `ai_chat`)
- `numeric` — limite quantitativo (ex: `max_staff = 10`, `max_bookings_per_month = 1000`)
- `enum` — escolha entre valores (ex: `support_tier = 'email' | 'priority' | 'dedicated'`)

**Limites com janela:** Para limites mensais (bookings, emails enviados), `featureUsage` tem um row por (tenant, feature, mês). Reset automático no primeiro dia do ciclo de cobrança do tenant.

**Soft vs hard limits:** Configurável por feature. Soft: avisa mas permite (com banner de upgrade). Hard: bloqueia ação completamente.

**Anti-pattern a evitar:** `if (plan === 'pro' && feature === 'ghl') { ... }` em qualquer lugar do código. Sempre via `requireFeature` ou `useFeature`.
