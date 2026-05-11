---
id: SEED-007
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Cortado — problema só com volume real (12+ meses)
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: quando o chat acumular >6 meses de conversas, ou quando consultas de admin ficarem lentas
scope: Small
---

# SEED-007: Arquivamento e paginação de conversas do chat

## Why This Matters

As tabelas `conversations` e `conversationMessages` crescem indefinidamente sem nenhuma política de arquivamento ou limpeza. A memória da conversa (`conversations.memory` JSONB) também cresce sem bounds para conversas longas. Depois de 6-12 meses em produção com chat ativo, a tabela de mensagens terá dezenas de milhares de registros que impactam queries de admin.

**Why:** O admin dashboard lista todas as conversas de uma vez (sem paginação no backend de algumas queries). À medida que o volume cresce, o tempo de carregamento do chat section vai aumentar progressivamente.

## When to Surface

**Trigger:** quando o admin começar a reclamar de lentidão no chat dashboard, quando a tabela `conversationMessages` ultrapassar 50k registros, ou ao iniciar um milestone de performance.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de performance / escalabilidade
- Milestone de ops / manutenção de dados
- 6+ meses após o chat estar em uso em produção

## Scope Estimate

**Small** — Algumas horas. Adicionar: (1) paginação no `GET /api/conversations` backend, (2) coluna `archivedAt` em `conversations`, (3) cron job mensal que arquiva conversas fechadas com >90 dias, (4) truncar `memory` JSONB para os últimos N turnos.

## Breadcrumbs

- `shared/schema.ts` — tabelas `conversations`, `conversationMessages` (sem `archivedAt`)
- `server/storage.ts` — `getConversations()` — verificar se tem LIMIT
- `server/routes.ts` — `GET /api/conversations` — verificar paginação
- `client/src/components/admin/` — seção de chat que lista conversas

## Notes

Arquivamento ≠ deleção. Conversas arquivadas devem ser consultáveis por ID mas excluídas das listagens padrão. A limpeza do `memory` JSONB deve manter apenas as últimas 10 mensagens para limitar tokens usados em re-hidratação de contexto de chat.
