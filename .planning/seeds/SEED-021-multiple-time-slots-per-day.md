---
id: SEED-021
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando qualquer staff precisar de pausa no almoço ou turno partido
scope: Medium
---

# SEED-021: Múltiplos slots de horário por dia (ex: 8h-12h e 14h-19h na segunda)

## Why This Matters

A tabela `staffAvailability` atual permite apenas UM período por dia por staff (`startTime`, `endTime`, `isAvailable`). Isso significa que se uma equipe trabalha de manhã e de tarde com pausa no almoço (8h-12h e 14h-19h), o sistema precisa configurar o dia inteiro como disponível (8h-19h), o que oferece slots de 12h-14h que ninguém pode atender.

As screenshots mostram exatamente isso: segunda tem 8:00am-12:00pm E 2:00pm-7:00pm como dois ranges separados, com o botão `+` para adicionar mais ranges e o botão de lixeira para remover individualmente.

**Why:** Empresas de limpeza frequentemente têm pausa operacional no meio do dia (almoço da equipe, transporte entre locais). Sem múltiplos slots, o sistema oferece horários que não existem.

## When to Surface

**Trigger:** quando o primeiro staff configurar horário partido, ou quando aparecer o primeiro booking num horário de pausa que não deveria estar disponível.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de availability / scheduling improvements
- Milestone de fidelidade ao calendário real de trabalho
- Qualquer milestone que toque em `staffAvailability` ou `getAvailableSlots`

## Scope Estimate

**Medium** — Uma fase. Schema: substituir a row única de `staffAvailability` por múltiplas rows por dia (`dayOfWeek`, `startTime`, `endTime`, `order`). Backend: `getAvailableSlots` já itera sobre os intervals disponíveis — precisa aceitar múltiplos ranges por dia. UI admin: botão `+` para adicionar range, lixeira por range, reordenar.

## Breadcrumbs

- `shared/schema.ts` — tabela `staffAvailability`: `id`, `staffMemberId`, `dayOfWeek`, `startTime`, `endTime`, `isAvailable` — constraint única por (staffMemberId, dayOfWeek) precisa mudar para permitir múltiplas rows
- `server/storage.ts` — `getStaffAvailability()`, `setStaffAvailability()` — precisam retornar/aceitar array de ranges por dia
- `server/routes/staff.ts` — `GET /api/staff/:id/availability`, `POST /api/staff/:id/availability`
- `client/src/components/admin/StaffSection.tsx` — UI de configuração de disponibilidade por dia
- `server/routes/availability.ts` (ou routes.ts) — `getAvailableSlots` que calcula slots — precisa iterar múltiplos ranges

## Notes

Migração cuidadosa: a tabela atual tem uma row por (staffMemberId, dayOfWeek). A nova estrutura permite múltiplas rows. Migration: adicionar coluna `order` (integer), remover unique constraint, permitir múltiplas rows. Existing data continua funcionando (uma row por dia = um range).

O algoritmo de available slots atual provavelmente une os ranges de disponibilidade com os ranges de bookings existentes. Com múltiplos ranges por dia, a lógica precisa iterar sobre cada range separadamente e acumular os slots.
