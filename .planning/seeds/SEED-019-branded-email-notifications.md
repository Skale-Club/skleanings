---
id: SEED-019
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando o primeiro tenant reclamar que os emails de confirmação de booking não têm a identidade visual deles
scope: Medium
---

# SEED-019: Templates de email branded por tenant (confirmação de booking, lembrete, cancelamento)

## Why This Matters

Hoje o sistema envia confirmações de booking mas não tem sistema de templates de email branded. Os emails enviados (Twilio para SMS, mas não há email transacional implementado) não têm logo, cores, ou nome da empresa do tenant. Para um produto white-label, o email de "Sua limpeza está confirmada!" precisa vir de `no-reply@limpezaxyz.com` com o logo e cores do tenant.

**Why:** Email transacional branded é o touchpoint mais frequente com o cliente final — é onde o white-label mais aparece ou some.

## When to Surface

**Trigger:** quando o primeiro tenant exigir emails branded, ou ao implementar email transacional (que ainda não existe — apenas SMS via Twilio).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de notificações / comunicação com cliente
- Milestone de white-label avançado
- Ao implementar email transacional pela primeira vez

## Scope Estimate

**Medium** — Uma fase. Componentes: (1) escolha de provider (Resend, Postmark, ou SendGrid — Resend recomendado pela DX); (2) templates React Email para confirmação, lembrete 24h antes, cancelamento, reagendamento; (3) admin UI para configurar from address e personalizar mensagens; (4) webhook de entrega para `notificationLogs`.

## Breadcrumbs

- `shared/schema.ts` — tabela `notificationLogs` já existe (SMS/Telegram) — email seria um novo `channel`
- `server/services/notifications.ts` — serviço de notificações existente — email seria adicionado aqui
- `shared/schema.ts` — `companySettings.companyEmail`, `logoMain`, `companyName` — usados nos templates
- Library recomendada: `resend` + `@react-email/components` (React Email para templates type-safe)
- Tabela nova: `emailSettings` (similar a `twilioSettings`) com API key, from address, enabled

## Notes

React Email permite escrever templates em JSX com componentes tipo shadcn/ui — altamente consistente com o stack atual. O from address precisa de domínio verificado no provider — o tenant precisa adicionar registros DNS. Documentar o processo de verificação no onboarding wizard (SEED-018).
