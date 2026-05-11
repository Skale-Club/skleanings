---
id: SEED-004
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: quando qualquer fase precisar modificar BookingPage ou AppointmentsCalendarSection
scope: Medium
---

# SEED-004: Dividir componentes gigantes (BookingPage 39KB, AppointmentsCalendarSection 49KB)

## Why This Matters

`BookingPage.tsx` tem 39KB e contém as 5 etapas do booking flow em um único arquivo: seleção de staff, calendário de disponibilidade, formulário do cliente, seleção de método de pagamento e confirmação. `AppointmentsCalendarSection.tsx` tem 49KB e mistura renderização do grid do calendário, lógica de drag-to-reschedule e o modal de criação de booking.

Cada fase que toca nesses arquivos aumenta o risco de conflito, dificulta code review, e torna impossible escrever testes unitários focados.

**Why:** Qualquer nova feature no booking flow (zipcode gating da Phase 18, novas opções de pagamento, novo step de confirmação) vai inflar ainda mais esses arquivos.

## When to Surface

**Trigger:** quando qualquer fase modificar BookingPage ou AppointmentsCalendarSection, ou quando adicionar um novo step ao booking flow.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone com mudanças no booking flow (nova etapa, novo método de pagamento)
- Milestone de refactoring/qualidade após White Label v2.0
- Milestone com testes unitários (SEED-001) — splitting é pré-requisito para testabilidade

## Scope Estimate

**Medium** — Uma fase. BookingPage: extrair `StepStaffSelector`, `StepTimeSlot`, `StepCustomerDetails`, `StepPaymentMethod`, `StepConfirmation`. AppointmentsCalendarSection: extrair `CalendarGrid`, `CreateBookingModal`, `RescheduleHandler`.

## Breadcrumbs

- `client/src/pages/BookingPage.tsx` — 39KB, 5 steps, estado compartilhado entre steps
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — 49KB, calendar + modal + drag
- `client/src/context/CartContext.tsx` — estado do cart compartilhado com BookingPage
- Padrão de referência: `client/src/components/admin/ServicesSection.tsx` (já usa sub-componentes bem)

## Notes

A divisão do BookingPage deve preservar o fluxo de state: o estado de cada step precisa ser gerenciado pelo componente pai (BookingPage) ou migrado para um contexto dedicado `BookingFlowContext`. Cuidado com o `useRef` fire-once guard para booking_started (Phase 15 decision) — não pode ser perdido na refatoração.
