---
id: SEED-001
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: início de qualquer fase que toque no booking flow, availability logic, ou GHL sync
scope: Large
---

# SEED-001: Adicionar suite de testes automatizados (vitest + React Testing Library)

## Why This Matters

O repositório não tem nenhum arquivo `.test.ts` ou `.spec.ts`. Todo o booking flow, lógica de disponibilidade, cálculo de preço por área, GHL sync e attribution são testados apenas manualmente. Qualquer fase futura que altere `POST /api/bookings`, `getAvailableSlots`, ou `recordConversionEvent` não tem rede de segurança — uma regressão só aparece em produção.

**Why:** risco de regressão aumenta quadraticamente com o número de fases. Phase 14 introduziu o create-from-calendar que duplicou caminhos de criação de booking. Phase 15+ multiplica isso com white-label. Sem testes, manutenção a longo prazo se torna inviável.

## When to Surface

**Trigger:** quando iniciar qualquer milestone após v2.0 White Label, ou quando o número de bugs reportados em produção aumentar, ou quando o time crescer e uma segunda pessoa tocar o codebase.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone inclui refactoring de componentes grandes (BookingPage, AppointmentsCalendarSection)
- Milestone inclui nova integração externa (novo gateway, novo CRM)
- Primeiro dev além do fundador começa a contribuir

## Scope Estimate

**Large** — Uma fase completa, talvez duas. Setup do vitest + RTL (1 plano), testes do booking flow backend (1 plano), testes do availability logic (1 plano), testes do attribution/analytics (1 plano).

## Breadcrumbs

Arquivos críticos sem cobertura:
- `server/routes.ts` — `POST /api/bookings` (~10KB de lógica de criação)
- `server/storage.ts` — `getAvailableSlots`, `recordConversionEvent`
- `client/src/pages/BookingPage.tsx` — 39KB, 5 etapas do booking flow
- `server/integrations/ghl.ts` — retry logic, timezone formatting
- `shared/schema.ts` — Zod validators usados em todo o sistema

Padrão de teste sugerido: Vitest para backend (Node-compatible), React Testing Library para componentes, MSW para mocking de APIs externas (Stripe, GHL).

## Notes

Nenhuma configuração de test runner existe (`vitest.config.ts`, `jest.config.ts`). Começar pelos happy paths do booking flow (site payment + stripe payment) antes de edge cases. O pessimistic locking (timeSlotLocks) é especialmente crítico de testar com concorrência simulada.
