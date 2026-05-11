---
id: SEED-015
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao ter 3+ tenants ativos, ou antes de implementar multi-tenancy
scope: Medium
---

# SEED-015: Super-admin panel (gerenciar todos os tenants em um painel)

## Why This Matters

Com múltiplos tenants, o time que opera o produto precisa de uma interface para ver todos os clientes, verificar health de cada instância, aplicar patches de configuração em massa, ver métricas agregadas de uso, e acessar o admin de qualquer tenant para suporte. Hoje isso é feito diretamente no banco de dados.

**Why:** Sem super-admin, operar 5+ tenants significa SSH no banco, queries manuais, e zero visibilidade de qual tenant está com problema. É o tipo de dívida operacional que explode quando a base cresce.

## When to Surface

**Trigger:** ao ter 3+ tenants ativos, ou ao iniciar o milestone de multi-tenancy (SEED-013), pois o super-admin é pré-requisito para gerenciar a migração.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de operações / multi-tenant
- Conjunto com SEED-013 (multi-tenant architecture)
- Quando começar a crescer para 5+ tenants

## Scope Estimate

**Medium** — Uma fase. Features mínimas: lista de todos os tenants (nome, plano, status, último acesso, bookings/mês), impersonation (acessar o admin de qualquer tenant como suporte), health check por tenant (DB conectado?, migrations aplicadas?), ação de mass-update em configurações.

## Breadcrumbs

- `server/middleware/auth.ts` — sistema de roles existente (admin/staff/viewer) — super-admin seria um novo role acima de admin
- `shared/schema.ts` — tabela `users` com `isAdmin` e `role` — novo role `superadmin`
- `server/routes/` — novas rotas `/api/superadmin/*` com guard separado
- `client/src/pages/admin/` — novo módulo de UI fora do admin normal do tenant
- Segurança: super-admin routes precisam de IP allowlist ou MFA obrigatório

## Notes

O super-admin panel é um produto separado do admin do tenant — mesmo stack, deploy separado ou sub-rota protegida (ex: `/superadmin`). Nunca expor rotas de super-admin nos mesmos endpoints do tenant admin — surface de ataque muito grande.
