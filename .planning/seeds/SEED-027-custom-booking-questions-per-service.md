---
id: SEED-027
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando o admin precisar de informações específicas por serviço antes de confirmar o booking
scope: Medium
---

# SEED-027: Perguntas customizadas de intake por serviço (booking questions)

## Why This Matters

O booking flow atual captura sempre os mesmos campos: nome, email, telefone, endereço. Mas cada serviço pode precisar de informações específicas:
- Limpeza residencial: "Quantos quartos?", "Tem pets?", "Algum produto para evitar?"
- Limpeza pós-obra: "Quantos m²?", "Há reboco/tinta fresca?"
- Limpeza de estofados: "Qual material do sofá?", "Manchas específicas?"

O Cal.com mostra isso como "Booking questions" — campos adicionais configuráveis por event type com tipos (text, long text, multiple choice, checkbox) e flag de obrigatório/opcional.

**Why:** Sem perguntas customizadas, o admin precisa ligar para cada cliente para coletar informações básicas antes do serviço — friction desnecessária que atrasa a confirmação.

## When to Surface

**Trigger:** quando o primeiro serviço especializado for adicionado que requer informações além do endereço, ou quando o admin implementar um fluxo de pré-qualificação.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de booking flow improvements
- Milestone de serviços especializados / expansão de catálogo
- Qualquer milestone que adicione novos tipos de serviço

## Scope Estimate

**Medium** — Uma fase. Schema: nova tabela `serviceBookingQuestions` (`id`, `serviceId` FK, `label`, `type` enum (text|textarea|select|checkbox|number), `options` JSONB (para select), `required` boolean, `order`). Os valores respondidos vão em `bookingItems.customerNotes` JSONB (já existe) ou nova coluna `questionAnswers` JSONB. UI: seção de perguntas na edição do serviço + renderização das perguntas no step de Customer Details do booking flow.

## Breadcrumbs

- `shared/schema.ts` — tabela `services` + `bookingItems` (tem `customerNotes` text — poderia virar JSONB ou adicionar `questionAnswers` JSONB)
- `server/routes/services.ts` — `GET /api/services/:id` — incluir `bookingQuestions` no response
- `client/src/pages/BookingPage.tsx` — step de Customer Details — renderizar perguntas dinâmicas
- `client/src/components/admin/ServicesSection.tsx` — UI de edição de serviço — seção "Booking Questions"

## Notes

O campo `customerNotes` em `bookingItems` já existe como texto livre — no curto prazo, documentar na UI admin que o staff deve pedir essas infos via notas. A seed é para a versão estruturada com campos tipados. Começar com 3 tipos: text, textarea, select — suficiente para 90% dos casos.
