---
id: SEED-024
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando um staff tiver compromissos pessoais no Google Calendar que conflitam com bookings
scope: Medium
---

# SEED-024: Verificação de conflitos em múltiplos calendários Google por staff

## Why This Matters

O sistema atual conecta apenas UM Google Calendar por staff (`staffGoogleCalendar` table — um registro por staff). Mas uma pessoa real tem múltiplos calendários: o de trabalho, o pessoal, o da família. O Cal.com mostra: você pode selecionar quais calendários verificar para conflitos — "Skale Club | Vanildo Junior", "Family", "skleanings@gmail.com", "Vanildo Agenda" — cada um com toggle independente.

Se a funcionária tem um compromisso pessoal às 14h no calendário "Family" mas o sistema só checa o calendário de trabalho, o booking de 14h é oferecido e cria um conflito real.

**Why:** Falsos-positivos de disponibilidade são o erro mais crítico num sistema de booking — o cliente confirma, a funcionária não pode aparecer. Checar múltiplos calendários é o único jeito de garantir disponibilidade real.

## When to Surface

**Trigger:** quando o primeiro staff conectar Google Calendar e reportar conflitos com compromissos pessoais, ou ao implementar o redesign completo do availability system (SEED-021/022/023).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de availability / conflict detection
- Milestone de Google Calendar integration improvements
- Conjunto com SEED-021/022/023 (availability system redesign)

## Scope Estimate

**Medium** — Uma fase. Schema: substituir `staffGoogleCalendar` (uma row por staff) por `staffCalendarConnections` (múltiplas rows — uma por calendário do Google Account, com `checkForConflicts` boolean e `addEventsTo` boolean). Backend: ao checar disponibilidade, buscar busy slots de TODOS os calendários com `checkForConflicts = true`.

## Breadcrumbs

- `shared/schema.ts` — tabela `staffGoogleCalendar`: `id`, `staffMemberId`, `accessToken`, `refreshToken`, `calendarId`, `tokenExpiresAt`, `needsReconnect` — precisa evoluir para suportar múltiplos calendários
- `server/lib/google-calendar/` — lógica de OAuth e busca de busy slots — precisa aceitar lista de calendarIds
- `server/routes/staff.ts` — `GET /api/staff/:id/google-calendar` — retorna lista de calendários disponíveis na conta OAuth do staff
- Google Calendar API: `calendar.calendarList.list()` retorna todos os calendários da conta — usar para popular a lista de toggle
- `client/src/components/admin/StaffSection.tsx` — UI de calendário → lista de calendários com toggles

## Notes

O OAuth scope precisa incluir `https://www.googleapis.com/auth/calendar.readonly` para listar os calendários disponíveis na conta. A UI mostra todos os calendários da conta Google do staff com dois toggles: "Check for conflicts" e "Add events to" (só um pode ter "Add events to" ativo por vez).

Migração: o `calendarId` existente em `staffGoogleCalendar` vira o primeiro entry em `staffCalendarConnections` com ambos os toggles ativos — comportamento preservado.
