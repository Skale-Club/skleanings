---
id: SEED-030
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando o admin quiser aprovar manualmente bookings antes de confirmar, especialmente para trabalhos grandes ou novos clientes
scope: Small
---

# SEED-030: Fluxo de confirmação manual por serviço (requires confirmation)

## Why This Matters

O Cal.com tem "Requires confirmation — The booking needs to be manually confirmed before it is pushed to your calendar and a confirmation is sent." Para serviços de limpeza de alto valor (limpeza pós-obra, limpeza comercial), o admin pode querer avaliar o pedido antes de confirmar: verificar disponibilidade real, negociar preço, confirmar acesso ao local.

Hoje o sistema cria bookings com status `pending` por padrão, mas não tem um fluxo de "esta categoria de serviço requer aprovação manual — o cliente sabe que aguarda confirmação".

**Why:** Serviços complexos ou de alto valor ($500+) merecem um processo de pré-qualificação. Sem confirmação manual, o cliente assume que está confirmado e o business pode ter problemas de capacidade.

## When to Surface

**Trigger:** ao adicionar serviços de alto valor (limpeza pós-obra, limpeza comercial), ou quando o admin começar a recusar bookings depois de criados (sinal de que precisa de pré-aprovação).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de serviços premium / enterprise
- Milestone de gestão de bookings / workflow de aprovação

## Scope Estimate

**Small** — Uma fase curta. Schema: adicionar `requiresConfirmation` boolean em `services` (default false). Backend: quando `requiresConfirmation = true`, booking é criado com status `awaiting_approval` ao invés de `pending`. Email/notificação para o cliente: "Seu pedido foi recebido — aguardando confirmação do business." Admin notificado para aprovar/rejeitar. Botões de Approve/Reject no painel de bookings.

## Breadcrumbs

- `shared/schema.ts` — tabela `services` — nova coluna `requiresConfirmation` boolean
- `shared/schema.ts` — tabela `bookings` — status enum pode ganhar `awaiting_approval`
- `server/routes/bookings.ts` — `POST /api/bookings` — lógica de status inicial baseada no serviço
- `client/src/components/admin/BookingsSection.tsx` — UI de aprovação com botões Approve/Reject
- `server/services/notifications.ts` — notificação ao admin de novo pedido aguardando aprovação

## Notes

"Disable cancelling" e "Disable rescheduling" são extensões naturais desta seed — quando `requiresConfirmation = true`, o admin pode também querer `cancellationPolicy: 'admin_only'`. Podem ser campos adicionais no mesmo schema change: `cancellationPolicy` e `reschedulePolicy` por serviço.

**Decisão (2026-05-10):** Feature é OPCIONAL por tenant. Default: `requiresConfirmation = false` para todos os serviços ao criar. Tenant ativa serviço a serviço, baseado em política de negócio dele:
- Tenant que confia em auto-confirmação (volume alto, baixo ticket) deixa todos desligados
- Tenant que prefere triagem (alto ticket, agendas complexas) ativa em todos
- Tenant pode ativar só em serviços premium (>$500) e deixar serviços comuns auto-confirmados

A configuração por serviço (e não global do tenant) é deliberada — flexibilidade máxima sem complicar o default.
