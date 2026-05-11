---
id: SEED-003
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: antes de qualquer campanha de marketing paga, ou quando o domínio ficar público/indexado
scope: Small
---

# SEED-003: Rate limiting nos endpoints públicos de analytics e chat

## Why This Matters

Os endpoints `POST /api/analytics/session` e `POST /api/analytics/events` são completamente públicos e não têm nenhuma proteção contra abuso. Um bot pode criar milhares de `visitorSessions` por minuto, inflando o marketing dashboard com dados falsos e potencialmente esgotando conexões do PostgreSQL. O chat (`POST /api/chat/message`) também é público e pode ser abusado para consumir cota de OpenAI/Gemini.

**Why:** O STATE.md registra isso como um bloqueio desde Phase 10: "Rate limiting strategy for POST /api/analytics/session (public endpoint) — not yet designed". Nunca foi resolvido.

## When to Surface

**Trigger:** antes de rodar qualquer campanha de tráfego pago (Google Ads, Meta Ads), antes de adicionar o domínio a um diretório público, ou quando o tráfego orgânico começar a crescer.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de performance/escalabilidade
- Milestone pré-lançamento de campanha de marketing
- Milestone de hardening / segurança

## Scope Estimate

**Small** — Algumas horas. Express-rate-limit com memória in-process para começar (sem Redis). Limites conservadores: 10 req/min por IP para analytics/session, 20 req/min por IP para chat/message.

## Breadcrumbs

- `server/routes.ts` — endpoints públicos: `POST /api/analytics/session`, `POST /api/analytics/events`, `POST /api/chat/message`
- `server/index.ts` — middleware setup, onde rate limiter seria aplicado
- Package sugerido: `express-rate-limit` (sem dependência extra para começar)

## Notes

Para um segundo estágio, usar Redis como backing store do rate limiter (`rate-limit-redis`) para sobreviver a restarts do processo. Para o chat, também considerar rate limit por conversationId além de IP — bots podem rotacionar IPs mas reutilizar conversation IDs.
