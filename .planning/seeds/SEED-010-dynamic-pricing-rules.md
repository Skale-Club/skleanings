---
id: SEED-010-dynamic-pricing-rules.md
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: quando a demanda crescer ao ponto de ter slots ociosos em alguns dias e overbooking em outros
scope: Large
---

# SEED-010: Regras de preço dinâmico (surge/desconto por demanda, dia da semana, horário)

## Why This Matters

O sistema atual tem preços fixos (com opção de desconto por frequência — weekly, biweekly). Não existe mecanismo para oferecer preços mais baixos em dias de baixa demanda (segunda-feira 8h) ou aplicar surge pricing em horários premium (sábado 10h). Para uma empresa de limpeza com capacidade finita de staff, pricing dinâmico é uma alavanca direta de revenue.

**Why:** A estrutura de pricing já é sofisticada (`pricingType`, `serviceOptions`, `serviceFrequencies`). Adicionar regras de ajuste de preço por slot é uma extensão natural — os dados de demanda já existem nas tabelas de bookings.

## When to Surface

**Trigger:** quando o negócio atingir >80% de ocupação em fins de semana consistentemente, ou quando o admin começar a criar promoções manualmente para dias específicos.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de revenue optimization / yield management
- Milestone pós White Label quando o produto estiver maduro e escalando
- Milestone de analytics avançado com dados históricos de demanda

## Scope Estimate

**Large** — Uma milestone. Schema: tabela `pricingRules` (dayOfWeek, timeRange, modifier %, priority). UI admin: rule builder. Backend: aplicar modificadores no cálculo de preço durante availability check. Frontend: mostrar preço ajustado no time slot selector.

## Breadcrumbs

- `shared/schema.ts` — tabelas `services` (pricingType, basePrice), `serviceFrequencies` (discountPercent) — extensão natural
- `server/routes.ts` — `GET /api/availability` — onde o preço final por slot seria calculado
- `client/src/pages/BookingPage.tsx` — StepTimeSlot, onde preço por slot seria exibido
- `server/storage.ts` — `getAvailableSlots()` — onde modifier seria aplicado

## Notes

Começar simples: regras por dia da semana + faixa de horário com um % de ajuste (positivo para surge, negativo para desconto). Não exige ML — regras manuais definidas pelo admin são suficientes para começar. Versão futura pode usar dados históricos de bookings para sugerir automaticamente as regras.
