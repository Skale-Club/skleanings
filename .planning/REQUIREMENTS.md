# Requirements — v5.0 Booking Experience

**Milestone:** v5.0 Booking Experience
**Goal:** Melhorar a experiência de booking com durações flexíveis, comunicação transacional por email e sync confiável com calendários externos.
**Status:** Active

---

## Milestone Requirements

### Múltiplas Durações por Serviço (SEED-029)

- [x] **DUR-01**: Admin pode configurar múltiplas durações para um serviço (label, duração em minutos, preço, ordem)
- [x] **DUR-02**: Admin pode adicionar, remover e reordenar durações na tela de editar serviço
- [x] **DUR-03**: Cliente vê cards de seleção de duração (label + tempo + preço) antes do calendário quando o serviço tem durações configuradas
- [x] **DUR-04**: Slot de disponibilidade calculado usa a duração selecionada pelo cliente, não a duração padrão do serviço
- [x] **DUR-05**: Duração e label selecionados ficam em snapshot no bookingItem no momento da criação do booking
- [x] **DUR-06**: Subscriptions recorrentes preservam a duração escolhida — gerador cria futuras instâncias com a mesma duração

### Emails Transacionais com Marca (SEED-019)

- [x] **EMAIL-01**: Admin pode configurar API key do Resend, from address e ativar/desativar emails transacionais no painel admin
- [ ] **EMAIL-02**: Cliente recebe email de confirmação de booking imediatamente após status confirmado, com detalhes do serviço, data, hora e endereço
- [x] **EMAIL-03**: Cliente recebe email de lembrete 24h antes do horário agendado via cron job
- [ ] **EMAIL-04**: Cliente recebe email de cancelamento imediatamente quando booking é cancelado (por cliente ou admin)
- [ ] **EMAIL-05**: Templates de email usam logo, nome da empresa e cores da marca vindos de companySettings

### Calendar Harmony — Retry Queue (SEED-002)

- [x] **SYNC-01**: Criação, atualização e cancelamento de booking enfileiram jobs de sync para Google Calendar e GoHighLevel em vez de chamar as APIs diretamente
- [x] **SYNC-02**: Worker processa a fila com SELECT FOR UPDATE SKIP LOCKED e backoff exponencial (1min → 5min → 30min → 2h → 24h → failed_permanent)
- [x] **SYNC-03**: Jobs são processados em transação única (sem orphans in_progress) com stale-row reaper para rows presas > 10min
- [ ] **SYNC-04**: Admin vê painel de observabilidade com contagem de jobs pending/failed por target (GCal, GHL) e tabela de falhas recentes com mensagem de erro
- [ ] **SYNC-05**: Admin pode acionar retry manual de jobs falhos por booking individual
- [ ] **SYNC-06**: Sistema detecta 10+ falhas consecutivas do mesmo target e exibe banner "Reconectar [GCal/GHL]" no admin
- [ ] **SYNC-07**: GitHub Actions workflow dispara o worker a cada 5 minutos (substitui node-cron — incompatível com Vercel serverless)

---

## Future Requirements

- Reagendamento por email (link no email de confirmação para escolher novo horário)
- Edição de body do email pelo admin (por ora: from-address + brand colors apenas)
- Suporte a múltiplos calendários Google por staff (SEED-024 — cancelado)
- Múltiplos fusos horários (SEED-011)

## Out of Scope

- Edição de HTML dos templates de email pelo admin — risco de quebrar layout; admin configura from-address e brand identity apenas
- Cart misto residencial/comercial (SEED-028 cancelado — plataforma foca em residencial)
- pg-boss ou Redis para fila — SELECT FOR UPDATE SKIP LOCKED é suficiente no volume atual
- Multiple Google Calendars per staff (SEED-024 — cancelado)

---

## Traceability

| REQ-ID | Phase | Plan |
|--------|-------|------|
| DUR-01 | Phase 30 | — |
| DUR-02 | Phase 30 | — |
| DUR-03 | Phase 30 | — |
| DUR-04 | Phase 30 | — |
| DUR-05 | Phase 30 | — |
| DUR-06 | Phase 30 | — |
| EMAIL-01 | Phase 31 | — |
| EMAIL-02 | Phase 31 | — |
| EMAIL-03 | Phase 31 | — |
| EMAIL-04 | Phase 31 | — |
| EMAIL-05 | Phase 31 | — |
| SYNC-01 | Phase 32 | — |
| SYNC-02 | Phase 32 | — |
| SYNC-03 | Phase 32 | — |
| SYNC-04 | Phase 32 | — |
| SYNC-05 | Phase 32 | — |
| SYNC-06 | Phase 32 | — |
| SYNC-07 | Phase 32 | — |
