---
id: SEED-012
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: quando o primeiro tenant não-inglês precisar do booking flow traduzido
scope: Large
---

# SEED-012: Internacionalização do booking flow (i18n — strings traduzíveis)

## Why This Matters

O produto é white-label mas todas as strings do booking flow estão hardcoded em inglês: "Add to cart", "Select a time", "Customer Details", "Book Now". Um tenant brasileiro não pode oferecer o site em português sem fazer fork e traduzir manualmente — o que derrota o propósito do white-label.

**Why:** i18n é um multiplicador de mercado. Com suporte a pt-BR + es-MX + en-US, o produto pode ser vendido para empresas de limpeza em qualquer país hispanofone ou lusófono — que juntos representam ~750 milhões de pessoas.

## When to Surface

**Trigger:** quando assinar o primeiro contrato com empresa fora dos EUA, ou quando iniciar marketing para mercados latino-americanos, ou quando SEED-011 (locale settings) estiver completa.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de expansão internacional
- Milestone pós SEED-011 (locale settings)
- Milestone de white-label avançado (v4.0+)

## Scope Estimate

**Large** — Uma milestone completa. Extrair todas as strings do booking flow para arquivos de tradução (react-i18next ou similar), criar arquivos en.json + pt-BR.json + es.json, wiring no frontend, seletor de idioma no booking flow, configuração do idioma padrão via `companySettings.language`.

## Breadcrumbs

- `client/src/pages/BookingPage.tsx` — strings hardcoded no booking flow
- `client/src/components/` — múltiplos componentes com strings hardcoded
- `client/src/context/` — CartContext, AuthContext — mensagens de erro hardcoded
- Library recomendada: `react-i18next` (madura, tree-shakeable, suporta namespaces por feature)
- `companySettings.language` (de SEED-011) — determina o locale padrão do site

## Notes

Começar apenas pelo booking flow público (não pelo admin) — é o que os clientes finais veem. Admin pode continuar em inglês numa primeira versão. Prioridade de tradução: pt-BR (mercado brasileiro imediato), depois es-MX.
