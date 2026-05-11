---
id: SEED-022
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando o primeiro staff precisar bloquear um dia específico ou ter horário diferente em uma data
scope: Small
---

# SEED-022: Date overrides — disponibilidade diferente em datas específicas

## Why This Matters

O sistema atual só configura disponibilidade por dia da semana (`dayOfWeek`). Se uma funcionária vai estar disponível no sábado 17/05 mas normalmente não trabalha no sábado, não há como configurar isso. Se a empresa vai fechar na sexta 23/05 (feriado), não há como bloquear apenas aquele dia.

As screenshots mostram "Date overrides — Add dates when your availability changes from your daily hours" com botão "+ Add an override" — exatamente esse caso de uso.

**Why:** Feriados, férias individuais, eventos especiais — qualquer negócio real tem datas que fogem do padrão semanal. Sem date overrides, o admin precisa cancelar bookings manualmente depois de aceitos.

## When to Surface

**Trigger:** quando o primeiro feriado chegar e o time precisar bloquear disponibilidade, ou quando SEED-021 (múltiplos slots por dia) for implementado — os dois fazem parte do mesmo sistema de availability redesign.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de availability / scheduling improvements
- Conjunto com SEED-021 (múltiplos slots)
- Milestone de gestão de agenda da equipe

## Scope Estimate

**Small** — Uma fase curta. Schema: nova tabela `staffAvailabilityOverrides` (`staffMemberId`, `date`, `isUnavailable` boolean, `startTime` nullable, `endTime` nullable). Backend: `getAvailableSlots` consulta overrides para a data antes de aplicar o schedule semanal. UI: calendário de datas + modal para configurar override.

## Breadcrumbs

- `shared/schema.ts` — nova tabela `staffAvailabilityOverrides` (`id`, `staffMemberId` FK, `date` date, `isUnavailable` boolean, `startTime` time nullable, `endTime` time nullable, `reason` text nullable)
- `server/storage.ts` — nova query `getStaffAvailabilityOverrides(staffMemberId, dateRange)`
- `server/routes/availability.ts` — `getAvailableSlots` precisa checar override antes de usar o schedule semanal
- `client/src/components/admin/StaffSection.tsx` — seção de configuração de disponibilidade

## Notes

Lógica de precedência: override tem prioridade sobre schedule semanal. Se override marca `isUnavailable = true`, o dia fica bloqueado independente do `dayOfWeek`. Se override tem startTime/endTime, substitui o horário do dia da semana. Se não há override, usa o schedule semanal normalmente.

A UI pode ser um calendário simples com dias clicáveis para adicionar/remover overrides — similar ao date picker existente no booking flow.
