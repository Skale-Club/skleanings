---
id: SEED-026
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando o admin reclamar que bookings estão sendo criados sem tempo de deslocamento entre serviços, ou quando configurar minimum notice for prioridade
scope: Medium
---

# SEED-026: Limites de booking por serviço (buffer time, minimum notice, time-slot intervals)

## Why This Matters

O sistema atual tem um único `minimumBookingValue` em `companySettings` mas nenhum controle por serviço de:
- **Buffer time antes/depois** — tempo de deslocamento entre serviços (sair da casa A, chegar na casa B)
- **Minimum notice** — com quantas horas de antecedência o booking pode ser feito (evitar bookings de última hora impossíveis de atender)
- **Time-slot intervals** — oferecer slots a cada 30min vs 1h vs duração do serviço

Para uma empresa de limpeza, buffer time é crítico: uma limpeza de 2h em Brooklin não pode ser seguida imediatamente por outra em Manhattan — precisa de 30-45min de deslocamento entre elas.

**Why:** Sem buffer time, o sistema oferece horários fisicamente impossíveis de atender com equipe que precisa se deslocar entre clientes.

## When to Surface

**Trigger:** quando o primeiro conflito de deslocamento aparecer, ou quando o admin configurar staff com múltiplos bookings no mesmo dia.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de scheduling / availability improvements
- Milestone de gestão de equipe em campo (field operations)
- Conjunto com SEED-021 (múltiplos slots por dia)

## Scope Estimate

**Medium** — Uma fase. Schema: adicionar em `services` colunas `bufferTimeBefore` (minutes, default 0), `bufferTimeAfter` (minutes, default 0), `minimumNoticeHours` (default 0), `timeSlotInterval` (minutes nullable — null = usa duração do serviço). Backend: `getAvailableSlots` aplica buffers ao calcular disponibilidade. UI: campos na aba de edição de serviço no admin.

## Breadcrumbs

- `shared/schema.ts` — tabela `services` — adicionar 4 colunas de limite
- `server/routes/availability.ts` — `getAvailableSlots` — aplicar buffer before/after ao marcar slot como ocupado
- `client/src/components/admin/ServicesSection.tsx` — UI de edição de serviço — nova seção "Booking Rules"
- `companySettings.minimumBookingValue` — existe, mas é em valor $ não em tempo — ambos coexistem

## Notes

Buffer "after event" é o mais crítico para limpeza — é o tempo de deslocamento até o próximo cliente. Buffer "before event" é útil para preparação (comprar supplies específicos). Time-slot intervals: para serviços de 3h, oferecer slots a cada 1h (não a cada 3h) dá mais flexibilidade ao cliente.
