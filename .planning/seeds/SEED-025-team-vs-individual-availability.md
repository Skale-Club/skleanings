---
id: SEED-025
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Cortado — só faz sentido com 5+ staff no tenant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando a empresa crescer e precisar de um horário padrão para toda a equipe vs exceções individuais
scope: Medium
---

# SEED-025: "My availability" vs "Team availability" — disponibilidade individual vs coletiva

## Why This Matters

O Cal.com mostra duas abas: "My availability" (horários do indivíduo) e "Team availability" (horários da equipe/empresa). No sistema atual, cada staff tem seu próprio `staffAvailability`, mas não há um conceito de "horário da empresa" que serve como padrão para todos os novos staff.

Quando uma empresa tem 10 funcionários todos com o mesmo horário (8h-18h, seg-sab), configurar um por um é desnecessário. O "Team availability" seria o template padrão; cada funcionário pode ter suas exceções individuais ("My availability").

**Why:** Onboarding de novos staff é lento quando há que reconfigurar o mesmo horário repetidamente. Um template de equipe acelera o processo e garante consistência.

## When to Surface

**Trigger:** ao ter 5+ staff members no sistema, ou ao implementar o availability redesign (SEED-021/022/023) — o conceito de schedules nomeados (SEED-023) é a base para team schedules.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de availability redesign (com SEED-023)
- Milestone de gestão de equipe maior
- Ao ter 5+ staff ativos

## Scope Estimate

**Medium** — Uma fase. Conceito: schedules "empresa" existem em `availabilitySchedules` sem `staffMemberId` (ou com `isCompanyDefault = true`). Novos staff herdam o schedule da empresa por padrão. UI: aba "Team availability" no admin mostra e edita o schedule padrão da empresa; aba "My availability" por staff mostra override individual.

## Breadcrumbs

- `shared/schema.ts` — tabela `availabilitySchedules` (de SEED-023): adicionar `isCompanyTemplate` boolean, `staffMemberId` nullable (null = company-level schedule)
- `server/routes/availability.ts` — ao criar novo staff, copiar o company template como schedule inicial
- `client/src/components/admin/StaffSection.tsx` — UI de disponibilidade com abas "Team" / "Individual"
- `client/src/components/admin/AvailabilitySection.tsx` — seção existente de disponibilidade global da empresa

## Notes

Depende de SEED-023 (named schedules) para existir — o "Team availability" é apenas um schedule marcado como company template. O comportamento de herança: novo staff começa com uma cópia do company template, não uma referência — mudanças no template não afetam staff existentes retroativamente (evita surpresas).
