---
id: SEED-029
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando um serviço precisar oferecer opções de duração diferentes para tamanhos de espaço diferentes
scope: Small
---

# SEED-029: Múltiplas durações por serviço (ex: Limpeza 2h / 4h / 8h)

## Why This Matters

O Cal.com mostra "Allow multiple durations" com o exemplo de "ACME" tendo 60m, 120m, e 240m como opções. Para limpeza, isso é direto: uma limpeza pode ser de 2h (studio), 4h (3 quartos), ou 8h (casa grande). O cliente escolhe a duração que corresponde ao seu espaço.

O sistema atual tem `durationMinutes` como campo único por serviço. Já existe `areaSizes` (JSONB) para o tipo `area_based`, mas múltiplas durações para o tipo `fixed_item` não existem.

**Why:** Oferecer "Limpeza 2h" e "Limpeza 4h" como serviços separados multiplica o catálogo desnecessariamente. Múltiplas durações no mesmo serviço é mais limpo e permite o cliente comparar no mesmo card.

## When to Surface

**Trigger:** quando o admin criar o segundo serviço que é essencialmente o mesmo serviço mas com duração diferente (sinal de que precisa de múltiplas durações).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de catálogo de serviços / pricing improvements
- Conjunto com SEED-027 (booking questions) — duração pode ser determinada pela resposta a "quantos m²?"

## Scope Estimate

**Small** — Uma fase curta. Schema: nova tabela `serviceDurations` (`id`, `serviceId` FK, `label` text, `durationMinutes` int, `price` numeric, `order`). Quando um serviço tem `serviceDurations`, o booking flow mostra um seletor de duração antes de ir para o calendário. `durationMinutes` no serviço vira o default/fallback.

## Breadcrumbs

- `shared/schema.ts` — tabela `services` (`durationMinutes`) + nova tabela `serviceDurations`
- `client/src/pages/BookingPage.tsx` — step de seleção de serviço — renderizar seletor de duração
- `server/routes/services.ts` — `GET /api/services/:id` — incluir `durations` no response
- `server/routes/availability.ts` — `getAvailableSlots` — receber `durationMinutes` dinâmico do serviço escolhido
- `client/src/components/admin/ServicesSection.tsx` — UI de edição — seção "Available durations"

## Notes

Padrão visual: cards ou botões de seleção com label ("2h — Apartamento pequeno — R$150"), similar ao `areaSizes` já existente para `area_based`. Preço pode variar por duração (mais horas = mais caro) — cada `serviceDuration` tem seu próprio `price`.
