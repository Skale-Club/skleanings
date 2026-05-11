---
id: SEED-002
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: quando GHL sync falhar silenciosamente em produção, ou quando começar a escalar volume de bookings
scope: Medium
---

# SEED-002: Fila de retry para GHL sync (contatos + appointments + UTM)

## Why This Matters

Atualmente, o sync com GoHighLevel acontece como fire-and-forget via void IIFE em `server/routes.ts`. Se a API do GHL estiver lenta, com rate limit, ou fora do ar no momento do booking, o contato e o appointment simplesmente não são criados no CRM — sem retry, sem alerta, sem registro de pendências.

O GHL sync já tem retry logic com backoff exponencial em `server/integrations/ghl.ts`, mas se todos os 3 retries falharem, a operação é descartada. Para bookings pagos via Stripe, o webhook chega depois — mas o GHL sync da confirmação de pagamento também é fire-and-forget.

**Why:** Em horários de pico, GHL frequentemente aplica rate limiting. Booking foi pago mas o CRM não tem o contato — o time de vendas opera às cegas.

## When to Surface

**Trigger:** quando volume de bookings aumentar (>50/dia), quando integração GHL for critical path para vendas, ou quando aparecer o primeiro relatório de "booking confirmado mas não aparece no GHL".

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de escalabilidade / performance
- Milestone de confiabilidade / ops
- Milestone que inclua melhorias nas integrações

## Scope Estimate

**Medium** — Uma fase. Opções: (A) tabela `ghlSyncQueue` com worker cron que reprocessa falhas, (B) usar BullMQ/pg-boss para job queue robusta, (C) webhook retry via GHL native retry config.

## Breadcrumbs

- `server/integrations/ghl.ts` — retry logic atual (3 tentativas, backoff 1-10s)
- `server/routes.ts` — void IIFE pattern em uso em múltiplos endpoints de booking
- `shared/schema.ts` — campos `ghlSyncStatus`, `ghlAppointmentId`, `ghlContactId` em `bookings` — já existe infraestrutura de status
- `server/storage.ts` — padrão de queries para criar tabela de queue

## Notes

O campo `ghlSyncStatus` já existe na tabela `bookings`. Poderia ser estendido para `pending_retry | synced | failed` e um cron job simples processar os pendentes a cada 5 minutos. Alternativa mais robusta: `pg-boss` que usa PostgreSQL como backend de queue — zero nova infraestrutura.
