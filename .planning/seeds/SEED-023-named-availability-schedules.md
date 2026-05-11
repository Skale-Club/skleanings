---
id: SEED-023
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando um staff precisar alternar entre dois schedules diferentes (ex: verão vs inverno)
scope: Medium
---

# SEED-023: Named availability schedules (múltiplos horários por staff, como "Working Hours Default")

## Why This Matters

O sistema atual tem um único schedule por staff. O Cal.com mostra que cada pessoa pode ter múltiplos schedules nomeados — "Working Hours Default", "Summer Schedule", "Part-time" — com um deles marcado como Default. Isso permite alternar entre configurações sem reconfigurar tudo do zero.

Para uma empresa com sazonalidade (mais serviços no verão, menos no inverno), poder ter "Horário de Verão" e "Horário de Inverno" como schedules nomeados e alternar entre eles é uma feature de produtividade real.

**Why:** Reconfigurar horários toda vez que a temporada muda é trabalhoso e propenso a erro. Schedules nomeados são o padrão em qualquer produto de scheduling maduro (Cal.com, Calendly, Acuity).

## When to Surface

**Trigger:** quando implementar SEED-021 (múltiplos slots por dia) e SEED-022 (date overrides) — os três formam o sistema de availability completo. Ou quando um staff reclamar de ter que reconfigurar horários sazonalmente.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de availability redesign completo (com SEED-021 e SEED-022)
- Milestone de gestão avançada de agenda

## Scope Estimate

**Medium** — Uma fase. Schema: tabela `availabilitySchedules` (`id`, `staffMemberId`, `name`, `isDefault`, `timezone`) — os `staffAvailability` rows referenciam um `scheduleId`. UI: lista de schedules com botão "Set as default", edição por schedule, botão "+ New schedule".

## Breadcrumbs

- `shared/schema.ts` — nova tabela `availabilitySchedules`; tabela `staffAvailability` ganha FK `scheduleId`
- `server/routes/availability.ts` — `getAvailableSlots` usa o schedule `isDefault = true` do staff
- `client/src/components/admin/StaffSection.tsx` — UI de schedules por staff
- Referência visual: screenshots do Cal.com — "Working Hours" com badge "Default", botão "Set as default", botão lixeira

## Notes

Implementar DEPOIS de SEED-021 — os schedules nomeados são um container para os múltiplos slots por dia. Sem SEED-021, um schedule nomeado com apenas um slot por dia tem menos valor. A migração cria um schedule default para cada staff existente e move os `staffAvailability` rows para esse schedule.
