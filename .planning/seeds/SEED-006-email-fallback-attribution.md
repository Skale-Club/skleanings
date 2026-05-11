---
id: SEED-006
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: quando o marketing dashboard começar a mostrar gaps de atribuição, ou quando otimizar ROAS de campanhas
scope: Small
---

# SEED-006: Fallback de atribuição via email quando localStorage é limpo

## Why This Matters

O sistema de atribuição usa um UUID em `localStorage` (`skleanings_visitor_id_${companySlug}`) para conectar visitas ao longo de dias com o booking final. Se o usuário limpar o localStorage, trocar de dispositivo, ou usar modo privado para finalizar o booking, a atribuição é perdida — o booking aparece como "direct" mesmo que tenha vindo de uma campanha paga.

A decisão no STATE.md documenta: "localStorage UUID — must survive multi-day booking journeys" mas não tem fallback.

**Why:** Campanhas de Google Ads e Meta Ads têm jornadas de 3-7 dias. Usuários que pesquisam no mobile e fecham no desktop perdem toda a atribuição. Isso subestima o ROAS de campanhas upper-funnel.

## When to Surface

**Trigger:** quando começar a otimizar campanhas pagas com base nos dados do marketing dashboard, ou quando o relatório de atribuição mostrar >30% de conversões sem source.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de marketing / attribution melhoria
- Milestone pós White Label v2.0 com foco em analytics
- Milestone de integração com plataformas de ads (Meta CAPI, Google Enhanced Conversions)

## Scope Estimate

**Small** — Poucas horas. Lógica: após booking criado com email do cliente, fazer lookup em `bookings` e `visitorSessions` pelo email para recuperar o `utmSessionId` de uma sessão anterior. Aplicar post-hoc se o booking atual não tem `utmSessionId`.

## Breadcrumbs

- `server/routes.ts` — `POST /api/bookings`, onde `linkBookingToAttribution` é chamado
- `server/storage.ts` — `getVisitorSessionByEmail()` seria uma nova query
- `shared/schema.ts` — tabela `visitorSessions` (tem `convertedAt`, sem campo de email)
- `shared/schema.ts` — tabela `bookings` (tem `customerEmail`)
- Decisão Phase 11: "linkBookingToAttribution silently no-ops when visitorId not found" — fallback de email seria chamado nesse caso

## Notes

Considerar adicionar `customerEmail` como campo opcional em `visitorSessions` durante a primeira visita (capturado se o usuário preencher um form). Isso permitiria cross-device attribution além do fallback pós-booking.
