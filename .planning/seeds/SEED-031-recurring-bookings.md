---
id: SEED-031
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando o primeiro cliente pedir para configurar limpeza semanal/quinzenal automática, ou ao lançar planos de manutenção
scope: Large
---

# SEED-031: Bookings recorrentes — assinatura de limpeza (semanal, quinzenal, mensal)

## Why This Matters

Limpeza recorrente é o modelo de negócio mais lucrativo para uma empresa de limpeza: o cliente não precisa re-agendar toda semana, a receita é previsível, e o churn é baixo. O Cal.com mostra "Recurring event — People can subscribe for recurring events."

O sistema atual tem `serviceFrequencies` (semanal, quinzenal, mensal) com desconto percentual — mas isso é apenas um desconto aplicado a um booking único, não um agendamento automático de bookings futuros. A diferença é enorme: com recorrência real, o sistema cria todos os bookings futuros automaticamente (ou um a um conforme a data se aproxima).

**Why:** Sem recorrência real, o cliente precisa re-entrar no site toda semana para agendar a próxima limpeza. Com recorrência, ele agenda uma vez e está feito. Isso reduz o custo de aquisição por transação e aumenta o LTV drasticamente.

## When to Surface

**Trigger:** quando o primeiro cliente ligar perguntando "como configuro limpeza semanal?", ou ao lançar um plano de assinatura de limpeza como produto.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de subscription / recorrência
- Milestone de revenue expansion (aumentar LTV)
- Pós SEED-014 (SaaS billing) — recorrência de bookings é o equivalente de produto ao billing recorrente de SaaS

## Scope Estimate

**Large** — Uma milestone completa. Componentes:
1. Schema: tabela `recurringBookings` (`id`, `contactId` FK, `serviceId`, `frequency` enum, `startDate`, `endDate` nullable, `status` active|paused|cancelled, `nextBookingDate`, `discountPercent`, `preferredStaffId`)
2. Backend: job cron que cria o próximo booking N dias antes da data (ex: 7 dias antes)
3. Frontend: seletor de frequência no booking flow com preview do calendário de limpezas futuras
4. Admin: painel de assinaturas recorrentes (listar, pausar, cancelar, alterar frequência)
5. Notificações: lembrete para o cliente 48h antes de cada limpeza recorrente

## Breadcrumbs

- `shared/schema.ts` — tabela `serviceFrequencies` (discountPercent) — já existe o conceito de frequência com desconto; recorrência real é a próxima etapa
- `shared/schema.ts` — tabela `bookings` — adicionar `recurringBookingId` FK nullable
- `server/routes/bookings.ts` — `POST /api/bookings` — suporte a criação de série recorrente
- `server/services/notifications.ts` — lembretes automáticos para bookings recorrentes
- `client/src/pages/BookingPage.tsx` — step de frequência com opção de ativar recorrência

## Notes

Estratégia de geração: criar o próximo booking apenas 7 dias antes (não todos de uma vez) — evita calendar pollution e permite ajustes de disponibilidade. O `serviceFrequencies` atual (com descountPercent) alimenta o preço dos bookings recorrentes diretamente — aproveitar a tabela existente.

"Pausar" é uma feature importante: cliente vai viajar em dezembro, pausa as limpezas e retoma em janeiro sem cancelar a assinatura. Isso é um diferencial de produto em relação a "cancelar e criar novo".
