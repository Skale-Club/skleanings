---
id: SEED-008
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: quando o primeiro bug sério em produção for difícil de diagnosticar via logs, ou ao escalar para múltiplos tenants
scope: Medium
---

# SEED-008: Logging estruturado e observabilidade (substituir console.log)

## Why This Matters

Todo o sistema usa `console.log` e `console.error` sem estrutura, sem contexto de requisição, sem correlation IDs. Quando um booking falha silenciosamente (GHL sync timeout, Stripe webhook malformado, attribution miss), o único sinal é uma linha de texto no log sem contexto de qual booking, qual tenant, qual usuário.

Em um sistema white-label com múltiplos tenants, isso se torna crítico — não há como filtrar logs por empresa, por booking ID, ou por sessão de usuário.

**Why:** Bugs em produção que envolvem timing (race conditions no time slot lock, GHL retry) são impossíveis de diagnosticar sem timestamps estruturados e correlation IDs. Console.log não tem fields, não tem níveis consistentes, não tem filtros.

## When to Surface

**Trigger:** ao adicionar o segundo tenant no white-label, ou quando um bug em produção levar >2h para diagnosticar, ou ao iniciar um milestone de escalabilidade.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de multi-tenancy (segundo tenant ativo)
- Milestone de escalabilidade / ops
- Pós-lançamento quando debugging se tornar crítico

## Scope Estimate

**Medium** — Uma fase. Escolha de library (pino — zero deps, JSON structured, muito rápido), instrumentação dos pontos críticos (booking creation, GHL sync, Stripe webhook, availability check), correlation ID middleware.

## Breadcrumbs

- `server/index.ts` — setup de middleware, onde logger global seria inicializado
- `server/routes.ts` — múltiplos `console.log`/`console.error` sem contexto
- `server/integrations/ghl.ts` — retry logic com `console.error` em falhas
- Library recomendada: `pino` (nativo Node.js, JSON output, zero overhead em produção)

## Notes

Pino + `pino-pretty` para desenvolvimento (legível) + JSON puro em produção (ingere em qualquer agregador: Datadog, Better Stack, Axiom). Correlation ID gerado por booking ID quando disponível, session ID de auth quando não. Não usar OpenTelemetry para começar — overhead desnecessário para o volume atual.
