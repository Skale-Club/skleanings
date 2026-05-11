---
id: SEED-020
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Cortado — só quando primeiro tenant pedir integração específica
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando um tenant precisar conectar o sistema a uma ferramenta externa diferente de GHL/Stripe
scope: Large
---

# SEED-020: API pública + webhooks para integrações de terceiros

## Why This Matters

Hoje o sistema tem integrações hardcoded (GHL, Stripe, Google Calendar, Twilio, Telegram). Cada novo tenant que usa Salesforce, HubSpot, Zapier, ou Make.com precisaria de uma integração customizada. Uma API pública com autenticação por API key + sistema de webhooks permite que tenants (e integradores) conectem o sistema a qualquer ferramenta externa sem código adicional.

**Why:** A maioria das empresas de limpeza já usa algum CRM ou ferramenta de automação. Sem API pública, o sistema é uma ilha — cada integração nova requer desenvolvimento. Com API + webhooks, o tenant integra por conta própria.

## When to Surface

**Trigger:** quando o primeiro tenant pedir integração com uma ferramenta que não é GHL, ou ao ter 5+ tenants (porque estatisticamente um deles vai pedir HubSpot ou Zapier).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de plataforma / ecossistema
- Ao ter 5+ tenants com necessidades diferentes de integração
- Milestone de white-label enterprise

## Scope Estimate

**Large** — Uma milestone. Componentes: (1) API keys por tenant (tabela `apiKeys` com hash, permissões, rate limits); (2) endpoints públicos documentados (`GET /v1/bookings`, `GET /v1/services`, `POST /v1/bookings`); (3) sistema de webhooks (tabela `webhookEndpoints`, eventos: `booking.created`, `booking.confirmed`, `booking.cancelled`); (4) painel de webhooks no admin (registrar URL, ver logs de entregas, replay); (5) documentação pública da API (Swagger/Redoc).

## Breadcrumbs

- `server/routes.ts` — endpoints existentes que seriam expostos na API pública (adaptados com auth por API key)
- `shared/schema.ts` — novas tabelas: `apiKeys`, `webhookEndpoints`, `webhookDeliveries`
- `server/middleware/auth.ts` — nova estratégia de auth: Bearer token de API key além de session cookie
- Padrão existente de retry: `server/integrations/ghl.ts` — retry logic reutilizável para webhook delivery
- Ferramentas de docs: `@scalar/express-api-reference` ou Swagger UI (zero overhead, integra com Express)

## Notes

Webhooks são mais difíceis que parecem — precisam de: delivery garantida (retry com backoff), idempotency keys, assinatura HMAC para verificação de autenticidade, logs de entrega consultáveis no admin. Começar com webhooks síncronos (fire-and-forget) e evoluir para fila assíncrona se a confiabilidade for crítica.
