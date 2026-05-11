---
id: SEED-009
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: quando migrar de Vercel para outro host, ou quando o blog cron começar a falhar silenciosamente
scope: Small
---

# SEED-009: Blog generation cron auto-hospedado (remover dependência do Vercel Cron)

## Why This Matters

O sistema de geração automática de blog posts depende do Vercel Cron para disparar `/api/blog/generate`. Isso cria uma dependência de infra-específica (Vercel) para uma feature de produto — se o app migrar para Fly.io, Railway, ou um VPS, o cron para de funcionar silenciosamente.

Adicionalmente, o Vercel Cron pode disparar múltiplas vezes simultaneamente em edge cases, o que o sistema tenta mitigar com um mecanismo de lock (`blogGenerationJobs.lockedAt`) — mas esse lock não foi battle-tested sob load.

**Why:** A tabela `systemHeartbeats` foi criada como keep-alive probe para o Vercel Cron — sinal de que a dependência já causou problemas de reliability.

## When to Surface

**Trigger:** ao avaliar migração de infraestrutura para fora do Vercel, ou quando o blog cron falhar por 2+ dias consecutivos, ou ao iniciar um milestone de self-hosting.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de migração de infraestrutura
- Milestone de self-hosting / on-prem para white-label
- Milestone de confiabilidade do blog

## Scope Estimate

**Small** — Algumas horas. Opção A: `node-cron` dentro do processo Express (simples, zero deps extra). Opção B: `pg-boss` com job agendado no PostgreSQL (mais robusto, sobrevive a restarts). Ambas eliminam Vercel Cron.

## Breadcrumbs

- `server/routes.ts` — endpoint `POST /api/blog/generate` (acionado pelo Vercel Cron)
- `shared/schema.ts` — tabelas `blogGenerationJobs`, `systemHeartbeats`
- `server/routes.ts` — `GET /api/heartbeat` ou similar — keep-alive para Vercel

## Notes

`node-cron` é zero-config mas não sobrevive a múltiplas instâncias (duplica jobs). `pg-boss` usa PostgreSQL como queue/scheduler e é cluster-safe — preferível se o app for escalado horizontalmente. Remover `systemHeartbeats` table após migração.
