---
id: SEED-013
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando assinar o segundo tenant pago, ou ao iniciar o modelo SaaS
scope: Large
---

# SEED-013: Arquitetura multi-tenant (isolamento de dados entre tenants)

## Why This Matters

Hoje o white-label funciona por deploy separado — cada tenant tem sua própria instância do app e seu próprio banco. Isso não escala como SaaS: cada novo cliente requer um novo deploy, novo banco, nova infra. Para um modelo SaaS real, múltiplos tenants precisam compartilhar a mesma infra com isolamento completo de dados.

**Why:** Sem multi-tenancy, o custo de infra por tenant é alto e o onboarding de novos clientes é manual. Com multi-tenancy, um único deploy serve N tenants — o custo marginal por novo cliente é próximo de zero.

## When to Surface

**Trigger:** ao assinar o segundo tenant pago (porque aí o problema de escalar deploys manualmente se torna real), ou ao iniciar um milestone de SaaS/plataforma.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de SaaS / plataforma multi-cliente
- Milestone de crescimento (escalar para 5+ tenants)
- Milestone após SEED-015 (super-admin panel)

## Scope Estimate

**Large** — Uma milestone de alta complexidade. Estratégias: (A) Row-Level Security no PostgreSQL com coluna `tenantId` em todas as tabelas — simples mas exige cuidado em cada query. (B) Schema separado por tenant no mesmo PostgreSQL — isolamento mais forte. (C) Database separado por tenant (modelo atual) mas com provisionamento automatizado. Recomendado: opção A (RLS) com Supabase para começar.

## Breadcrumbs

- `shared/schema.ts` — TODAS as tabelas precisariam de `tenantId` coluna
- `server/storage.ts` — TODAS as queries precisariam de filtro por `tenantId`
- `server/index.ts` — middleware de resolução de tenant (por domínio ou por header)
- `server/routes/` — autenticação de admin precisa ser scoped por tenant
- Supabase RLS: políticas por tenant usando `current_setting('app.tenant_id')` — funciona com o stack atual

## Notes

Esta é a maior mudança arquitetural do projeto. Não deve ser feita até ter demanda real de múltiplos tenants — o custo de migração é alto. Quando o momento chegar, fazer feature-branch longa e migrar tabela por tabela com testes antes de mergar. Considerar SEED-015 (super-admin) antes de iniciar — o super-admin precisa existir para gerenciar múltiplos tenants.
