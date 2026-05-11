---
id: SEED-005
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: quando expandir funcionalidades do portal do cliente, ou adicionar social login
scope: Large
---

# SEED-005: Unificar sistema de autenticação (Supabase Auth para admin e clientes)

## Why This Matters

O sistema atual tem dois mecanismos de autenticação paralelos: Supabase Auth para admins (magic link / password via Supabase) e autenticação session-based com bcrypt para clientes (customer portal). Isso resulta em dois middlewares diferentes, dois fluxos de login, dois tipos de cookie, e lógica condicional em vários endpoints.

O comentário em `server/lib/auth.ts` documenta que `authenticatedRequest` usa Bearer token do Supabase enquanto `apiRequest` usa cookie de sessão — a Phase 14 já encontrou um bug por causa disso (customer type-ahead teve que usar `apiRequest` em vez de `authenticatedRequest`).

**Why:** Cada nova feature do portal do cliente aumenta a chance de usar o mecanismo errado. A decisão registrada no STATE.md confirma que isso é um risco conhecido.

## When to Surface

**Trigger:** quando expandir o portal do cliente com novas features (histórico de compras, notificações por email, preferências salvas), ou quando adicionar social login (Google, Apple).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de expansão do portal do cliente
- Milestone de social login / OAuth para clientes
- Milestone pós White Label v2.0 com foco em experiência do usuário

## Scope Estimate

**Large** — Uma milestone completa. Migrar clientes para Supabase Auth, mapear roles (admin/staff/viewer/customer) em Supabase JWT claims, remover bcrypt session-based auth, unificar middleware.

## Breadcrumbs

- `server/lib/auth.ts` — `getAuthenticatedUser()`, dois mecanismos paralelos
- `server/middleware/auth.ts` — proteção de rotas
- `client/context/AuthContext.tsx` — estado de auth do cliente
- `client/src/pages/ClientLogin.tsx` — login do portal do cliente
- `client/src/pages/AccountShell.tsx` — portal do cliente autenticado
- `server/routes.ts` — endpoints `/api/client/*` com sessão bcrypt

## Notes

A decisão arquitetural foi documentada como "works but adds complexity". Unificação exige que clientes existentes migrem suas senhas (pode ser um reset forçado com link por email). Considerar period de transição com fallback duplo antes de remover bcrypt.
