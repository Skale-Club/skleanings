---
id: SEED-011
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao onboardar o primeiro tenant não-inglês (confirmado que haverá tenants não-inglês no Xkedule, em menor intensidade)
scope: Small
priority: medium
---

# SEED-011: Configurações de locale no admin (idioma, start of week, formato de data)

## Why This Matters

O `companySettings` já tem `timeFormat` (12h/24h) e `timeZone`, mas não tem `language` nem `startOfWeek`. Para um produto white-label servindo diferentes mercados, essas configurações são básicas:
- Empresa brasileira quer semana começando na segunda, datas em pt-BR, formato 24h
- Empresa americana quer semana começando no domingo, datas en-US, formato 12h

Atualmente `timeFormat` existe na tabela mas não há `language` nem `startOfWeek`. O calendário admin usa hardcoded `Sunday` como início de semana.

**Why:** Cada novo tenant em um mercado diferente vai pedir isso no primeiro mês de uso. É o tipo de detalhe que parece pequeno mas bloqueia adoção.

## When to Surface

**Trigger:** ao iniciar qualquer milestone de internacionalização, ou quando adicionar o primeiro tenant fora dos EUA.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de locale / internacionalização
- Milestone de onboarding de novos tenants internacionais
- Milestone de white-label self-serve

## Scope Estimate

**Small** — Uma fase curta. Schema: adicionar `language` (text, default 'en') e `startOfWeek` (text, default 'sunday') em `companySettings`. UI: adicionar selects na seção General de Company Settings — Language, Start of week. Consumo: calendário admin respeita `startOfWeek`, frontend usa `language` para Intl.DateTimeFormat.

## Breadcrumbs

- `shared/schema.ts` — tabela `companySettings`, já tem `timeFormat` e `timeZone` (padrão para novos campos)
- `client/src/components/admin/CompanySettingsSection.tsx` — onde novos selects seriam adicionados
- `client/src/components/admin/AppointmentsCalendarSection.tsx` — consome configurações de calendário; `startOfWeek` afetaria `culture` prop do RBC
- `client/src/hooks/useCompanySettings.ts` — hook que expõe settings para o frontend
- `react-big-calendar` — suporta `culture` prop para localização do calendário

## Notes

O seletor de Language no admin controla o locale padrão do site público (booking flow). Cada tenant fica em um locale. Não é i18n completo (não traduz strings) — é locale para formatação de datas, números e moeda.

**Decisão estratégica (2026-05-10):** SEED-012 (i18n completo) foi cancelado. Esta seed (locale settings) cobre o caso de menor intensidade: tenant não-inglês recebe UI em inglês mas com formatação de datas/números/moeda no locale dele. Tradução completa do booking flow fica para um momento muito futuro.
