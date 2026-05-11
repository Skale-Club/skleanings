---
id: SEED-032
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao migrar para Xkedule multi-tenant — primeiro tenant que precisar receber pagamentos online dos próprios clientes
scope: Large
---

# SEED-032: Stripe Connect — tenant conecta sua conta Stripe via OAuth (plug & play)

## Why This Matters

Hoje o Skleanings tem Stripe integrado com uma única API key (a do dono atual). Quando virar Xkedule multi-tenant, **cada tenant precisa receber os pagamentos dos próprios clientes na conta Stripe DELE** — não na conta da Xkedule.

A solução é **Stripe Connect com OAuth**: o tenant clica em "Conectar Stripe" no admin → é redirecionado para o Stripe → autoriza a Xkedule → volta com tokens armazenados no banco. A partir daí, todos os checkouts dos clientes daquele tenant são criados na conta Stripe do tenant via `stripeAccount` parameter.

**Why:** Sem Stripe Connect, o dinheiro dos clientes finais entraria na conta da Xkedule e teria que ser repassado manualmente — operação inviável legalmente (a Xkedule não é processadora de pagamentos), fiscalmente (NF do tenant não pode ser emitida sobre receita da Xkedule), e operacionalmente. Stripe Connect resolve tudo isso de forma plug & play.

Este é um billing **completamente separado** do SEED-014 (Xkedule cobrando tenants). Aqui é tenant cobrando os clientes finais.

## When to Surface

**Trigger:** ao planejar a migração do Skleanings para Xkedule multi-tenant (SEED-013), porque o sistema de pagamento atual precisa ser refatorado para Stripe Connect antes do segundo tenant existir.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de SaaS Xkedule (conjunto com SEED-013)
- Milestone de pagamentos / financeiro
- Antes do primeiro segundo tenant pagante

## Scope Estimate

**Large** — Uma fase completa. Componentes:

1. **Schema:**
   - `tenantStripeConnections` (tenantId FK unique, stripeAccountId, accessToken, refreshToken, scope, livemode, chargesEnabled, payoutsEnabled, detailsSubmitted, connectedAt, lastSyncedAt)
   - Migration: remover Stripe API key de `integrationSettings` (era global) — agora cada tenant tem sua conexão

2. **OAuth flow:**
   - `GET /api/admin/integrations/stripe/connect` — gera URL de autorização do Stripe Connect e redireciona
   - `GET /api/admin/integrations/stripe/callback` — recebe `code`, troca por access token via `stripe.oauth.token`, salva em `tenantStripeConnections`
   - `POST /api/admin/integrations/stripe/disconnect` — chama `stripe.oauth.deauthorize` e remove tokens
   - Sincronização: `GET /api/admin/integrations/stripe/account` — chama `stripe.accounts.retrieve(stripeAccountId)` para refrescar status de `chargesEnabled` etc.

3. **Checkout refactor:**
   - `POST /api/payments/create-session` — antes usava API key global; agora aceita o tenant do middleware, busca `tenantStripeConnections`, cria session com `{ stripeAccount: connection.stripeAccountId }`
   - Webhook handler — agora processa eventos de múltiplas contas connected; usar `event.account` para identificar o tenant

4. **UI admin:**
   - Seção "Pagamentos" com botão grande "Conectar Stripe" se não conectado
   - Se conectado: mostra account ID, status (chargesEnabled, payoutsEnabled), botão "Reconectar" e "Desconectar"
   - Banner se `detailsSubmitted = false` (precisa completar onboarding do Stripe)

5. **Booking flow guard:**
   - Se o tenant não tem Stripe conectado OU `chargesEnabled = false`, esconder opção "Pagar online" do customer booking flow — só mostrar "Pagar no local"

## Breadcrumbs

- `server/routes/payments.ts` — endpoints atuais de Stripe que precisam ser refatorados para usar `stripeAccount` parameter
- `shared/schema.ts` — tabela `integrationSettings` (tem Stripe key hoje) + nova `tenantStripeConnections`
- `client/src/pages/BookingPage.tsx` — step de payment method que precisa esconder "online" se tenant não tem Stripe
- Stripe Connect docs: Standard accounts (recomendado — tenant tem dashboard próprio) vs Express accounts (mais simples mas Xkedule responsável por compliance)
- App registrada no Stripe: precisa de Connect application com OAuth flow habilitado, redirect URI configurada, branding

## Notes

**Standard vs Express accounts:**
- **Standard (recomendado):** Tenant cria/usa conta Stripe própria. Tem dashboard Stripe completo, gerencia disputas, payouts vão direto pra ele. Xkedule só facilita o pagamento.
- **Express:** Conta criada via API, Xkedule responsável por onboarding e compliance. Mais friction.

Começar com Standard. Se um tenant não tem conta Stripe ainda, o Stripe Connect cria durante o OAuth (`stripe.com/connect/...?signup`).

**Application fee (revenue share):** Stripe Connect permite Xkedule cobrar uma taxa por transação (`application_fee_amount` no checkout session). Pode ser modelo de receita adicional — ex: 1% por transação processada além da mensalidade. Configurável por plano (SEED-017).

**Webhook routing:** Eventos de contas connected chegam no webhook da Xkedule com `event.account` populado. Lookup `tenantStripeConnections.stripeAccountId` → resolve tenant → processar.

**Tokens:** `access_token` do Stripe Connect não expira (não precisa refresh) — diferente de OAuth tradicional. Mas se o tenant revogar acesso no dashboard Stripe, o token vira inválido — capturar erros e marcar `connection.status = 'revoked'`.

**Princípio:** Plug & play significa que o tenant nunca toca em API key, secret key, webhook secret — Xkedule cuida disso. O tenant só clica em "Conectar" e autoriza.
