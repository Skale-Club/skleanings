---
id: SEED-002
status: dormant
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao implementar o módulo de bookings do Xkedule — calendar harmony deve estar pronto antes do segundo tenant
scope: Large
---

# SEED-002: Calendar Harmony — sincronização robusta com Google Calendar (prio 1) + GHL (prio 2)

## Why This Matters

Hoje o Xkedule terá pelo menos dois sistemas externos de calendário que precisam ficar em sincronia com os bookings internos:

1. **Google Calendar** (prioridade 1) — é a fonte de verdade pessoal de cada staff. É onde a pessoa marca compromissos próprios, e onde precisa aparecer cada booking confirmado para que a equipe veja na agenda no celular.
2. **GoHighLevel** (prioridade 2) — CRM da empresa. Precisa receber o contato e o appointment para que o time comercial veja o pipeline e atue em pós-venda.

Atualmente:
- Google Calendar sync existe mas falha silenciosamente em alguns casos (token expirado, calendar disconnect)
- GHL sync é fire-and-forget (void IIFE) — se a API estiver lenta ou rate-limited, perde o registro sem retry

**Problema central:** os três sistemas (DB interno, Google Calendar, GHL) precisam estar consistentes. Sem isso, staff aparece num lugar e não em outro, cliente é confirmado mas não consta no CRM, ou agenda interna mostra disponibilidade que o Google Calendar diz que está ocupada.

**Why:** Calendar harmony não é só "GHL retry" — é o sistema unificado que garante que os 3 calendários (interno, Google, GHL) ficam consistentes mesmo com falhas temporárias.

## When to Surface

**Trigger:** ao implementar o módulo de bookings do Xkedule (junto com SEED-013 multi-tenant), ou quando o primeiro relatório de "booking confirmado mas não apareceu no Google Calendar/GHL" chegar.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de Xkedule SaaS (conjunto com SEED-013)
- Milestone de calendar / scheduling robustness
- Milestone de integrações externas

## Scope Estimate

**Large** — Uma fase substancial. Componentes:

1. **Schema:**
   - Tabela `calendarSyncQueue` (id, bookingId FK, target enum (`google_calendar` | `ghl_appointment` | `ghl_contact` | `ghl_utm`), operation enum (`create` | `update` | `delete`), payload JSONB, status (`pending` | `in_progress` | `success` | `failed_retryable` | `failed_permanent`), attempts, lastAttemptAt, lastError, scheduledFor, completedAt)
   - Reaproveitar campos existentes em `bookings`: `ghlSyncStatus`, `ghlAppointmentId`, `ghlContactId`

2. **Backend:**
   - Worker (cron a cada 1min via GH Actions ou node-cron) que pega rows `pending` com `scheduledFor <= now()`, marca `in_progress`, processa
   - Backoff exponencial: 1min → 5min → 30min → 2h → 12h → 24h → mark permanent failed
   - Idempotência: usar `ghlAppointmentId` / Google `eventId` como chave; se já existe, não recriar
   - Dois sync paths consolidados num único worker (Google + GHL) para garantir ordem: Google primeiro (prio 1), depois GHL (prio 2)

3. **Conflict resolution:**
   - Quando booking é editado/cancelado, enfileirar update/delete em ambos os calendários
   - Lock pessimista por (bookingId, target) para evitar race conditions

4. **Admin observability:**
   - Painel "Calendar sync health" no admin do tenant: contador de jobs pending/failed por target
   - Botão "Retry now" para forçar reprocessamento manual de um booking específico
   - Alerta visual quando um booking tem sync failed_permanent

## Breadcrumbs

- `server/integrations/ghl.ts` — retry logic atual (3 tentativas) — vira o consumer chamado pelo worker
- `server/lib/google-calendar/` — sync atual do Google Calendar
- `server/routes.ts` — endpoints de booking creation/update — substitui chamadas síncronas por enfileirar na `calendarSyncQueue`
- `shared/schema.ts` — campos `ghlSyncStatus`, `ghlAppointmentId`, `ghlContactId` em `bookings` — fonte de verdade do status do último sync bem-sucedido
- Worker pattern: pg-boss ou implementação manual com `SELECT ... FOR UPDATE SKIP LOCKED`

## Notes

**Prioridade Google > GHL:** ao processar a fila, jobs para Google Calendar são executados ANTES de jobs GHL do mesmo booking. Razão: Google Calendar é o que aparece no telefone do staff que vai executar o serviço — falha aqui é problema operacional imediato. GHL é CRM — falha é problema de pipeline comercial, menos urgente.

**Reconnect flow:** quando token Google expira ou GHL muda credenciais, todos os jobs daquele tenant entram em `failed_retryable` em loop. Worker detecta padrão (>10 falhas seguidas do mesmo target/tenant) e marca `connection.needs_reconnect = true` — admin vê banner de "reconectar Google Calendar/GHL" no admin.

**Não usar pg-boss para começar:** worker simples com `SELECT ... FOR UPDATE SKIP LOCKED` em cron de 1min é suficiente para o volume inicial. Migrar para pg-boss se ficar gargalo.
