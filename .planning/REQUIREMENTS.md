# Requirements — v6.0 Platform Quality

**Milestone:** v6.0 Platform Quality
**Goal:** Melhorar segurança, manutenibilidade e confiabilidade da plataforma sem adicionar features visíveis ao usuário final.
**Status:** Active

---

## Milestone Requirements

### Rate Limiting — Endpoints Públicos (SEED-003)

- [x] **RATE-01**: `POST /api/analytics/session` aceita no máximo 10 req/min por IP; excesso retorna 429 com header `Retry-After`
- [x] **RATE-02**: `POST /api/analytics/events` aceita no máximo 10 req/min por IP; excesso retorna 429
- [x] **RATE-03**: `POST /api/chat/message` aceita no máximo 20 req/min por IP; excesso retorna 429
- [x] **RATE-04**: Rate limiter usa `express-rate-limit` em memória com `standardHeaders: true` e `legacyHeaders: false`

### Split de Componentes Gigantes (SEED-004)

- [x] **SPLIT-01**: `BookingPage.tsx` refatorado para orquestrador thin — cada step extraído para sub-componente dedicado (`StepStaffSelector`, `StepTimeSlot`, `StepCustomerDetails`, `StepPaymentMethod`, `StepConfirmation`)
- [x] **SPLIT-02**: Estado compartilhado entre steps permanece no BookingPage pai (fluxo existente não se quebra)
- [x] **SPLIT-03**: Guard `useRef` fire-once do `booking_started` (Phase 11) preservado após o split
- [ ] **SPLIT-04**: `AppointmentsCalendarSection.tsx` refatorado — `CreateBookingModal` e drag-to-reschedule extraídos em componentes separados
- [ ] **SPLIT-05**: Fluxo completo de booking funciona após o split (sem regressões visíveis)

### Blog Cron via GitHub Actions (SEED-009)

- [ ] **BLOG-01**: Workflow `.github/workflows/blog-cron.yml` dispara `POST /api/blog/generate` diariamente às 9h UTC com autenticação Bearer `BLOG_CRON_TOKEN`
- [ ] **BLOG-02**: Endpoint `POST /api/blog/generate` rejeita requests sem `Authorization: Bearer <BLOG_CRON_TOKEN>` com 401
- [ ] **BLOG-03**: Vercel Cron config de blog generation removida de `vercel.json`
- [ ] **BLOG-04**: Tabela `systemHeartbeats` removida (keep-alive era para Vercel — desnecessária com GH Actions)

---

## Future Requirements

- Redis como backing store para rate limiter (sobrevive reinicializações)
- Rate limiting por conversationId além de IP
- Testes unitários nos sub-componentes extraídos (SEED-001)

## Out of Scope

- Migração para Hetzner — SEED-009 prepara infra de cron, migração de servidor é SEED-013
- Redis para rate limiter — memória suficiente para volume atual
- Multi-tenant blog cron — escopo Xkedule futuro

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| RATE-01 | Phase 33 | — |
| RATE-02 | Phase 33 | — |
| RATE-03 | Phase 33 | — |
| RATE-04 | Phase 33 | — |
| SPLIT-01 | Phase 34 | — |
| SPLIT-02 | Phase 34 | — |
| SPLIT-03 | Phase 34 | — |
| SPLIT-04 | Phase 34 | — |
| SPLIT-05 | Phase 34 | — |
| BLOG-01 | Phase 35 | — |
| BLOG-02 | Phase 35 | — |
| BLOG-03 | Phase 35 | — |
| BLOG-04 | Phase 35 | — |
