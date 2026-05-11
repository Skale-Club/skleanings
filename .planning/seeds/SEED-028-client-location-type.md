---
id: SEED-028
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando adicionar serviços que não são no endereço do cliente, ou ao expandir para serviços híbridos
scope: Small
---

# SEED-028: Tipo de localização por serviço (client's address, business address, pickup)

## Why This Matters

Hoje todos os bookings assumem que o serviço é prestado no endereço do cliente (`customerAddress` em `bookings`). O Cal.com mostra que cada "event type" pode ter um tipo de localização diferente: "In person (attendee address)" = casa do cliente, "In person (organizer address)" = endereço comercial, "Phone call", etc.

Para uma empresa de limpeza que pode crescer para incluir:
- **Client's address** (padrão — limpeza residencial/comercial onde o cliente está)
- **Drop-off** (cliente traz tapetes/estofados para limpeza no depósito)
- **On-site consultation** (visita para orçamento antes do serviço)

Cada um tem uma UX diferente no booking flow: "client's address" pede endereço completo, "drop-off" pede o horário de chegada no depósito, "consultation" é mais curto.

**Why:** À medida que o catálogo de serviços cresce, alguns não acontecem na casa do cliente. Sem tipo de localização por serviço, o booking flow sempre pede um endereço que pode não ser necessário.

## When to Surface

**Trigger:** ao adicionar o primeiro serviço que não é no endereço do cliente (ex: "Limpeza de tapete — trazer ao depósito"), ou ao lançar serviços de consultoria/orçamento.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de expansão de catálogo de serviços
- Milestone de novos tipos de serviço (pickup, consultation)
- Qualquer milestone que modifique o booking flow step de endereço

## Scope Estimate

**Small** — Uma fase curta. Schema: adicionar `locationType` em `services` (enum: `client_address` | `business_address` | `pickup` | `phone` | `online`, default `client_address`). Backend: `POST /api/bookings` valida o endereço apenas quando `locationType = client_address`. UI: booking flow mostra/esconde campo de endereço baseado no `locationType` do primeiro serviço no cart.

## Breadcrumbs

- `shared/schema.ts` — tabela `services` — nova coluna `locationType`
- `client/src/pages/BookingPage.tsx` — step de Customer Details — campo de endereço condicional
- `server/routes/bookings.ts` — `POST /api/bookings` — validação condicional de endereço
- `client/src/components/admin/ServicesSection.tsx` — UI de edição — dropdown de "Location type"
- `companySettings.companyAddress` — endereço da empresa usado quando `locationType = business_address`

## Notes

Quando o cart tem serviços com `locationType` mistos (raro mas possível), usar o do serviço principal (maior preço). Para `phone` e `online`, o campo de endereço some do booking flow e o campo de telefone fica obrigatório. O endereço da empresa para `business_address` vem de `companySettings.companyAddress`.
