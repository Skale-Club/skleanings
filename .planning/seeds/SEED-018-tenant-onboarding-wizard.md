---
id: SEED-018
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao iniciar venda self-serve do produto (sem onboarding manual)
scope: Large
---

# SEED-018: Wizard de onboarding self-serve para novos tenants

## Why This Matters

Hoje o onboarding de um novo tenant é completamente manual: configurar banco de dados, fazer deploy, configurar variáveis de ambiente, popular companySettings no banco. Para escalar, um novo cliente precisa conseguir se cadastrar, configurar o básico, e ter o sistema funcionando sem intervenção técnica.

**Why:** O custo de onboarding manual é o principal gargalo para escalar o produto. Com self-serve, um novo cliente pode estar operacional em 15 minutos.

## When to Surface

**Trigger:** ao iniciar campanha de aquisição ativa de novos tenants, ou ao ter SEED-013 (multi-tenant) e SEED-014 (billing) implementados — o wizard é a camada de UX em cima da infra.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de growth / aquisição
- Pós SEED-013 + SEED-014 (infra e billing prontos)
- Milestone de produto completo (pronto para vendas)

## Scope Estimate

**Large** — Uma milestone. Etapas do wizard: (1) Signup com email/senha; (2) Dados da empresa (nome, telefone, endereço, logo); (3) Seleção de plano + billing Stripe; (4) Configuração de serviços (import de template ou criar do zero); (5) Configuração de horários; (6) Integração GoHighLevel (opcional); (7) Preview do site público; (8) Go live.

## Breadcrumbs

- `client/src/pages/ClientLogin.tsx` — padrão de autenticação existente — wizard seria uma rota pública nova
- `server/routes/auth.ts` — signup existente — precisa de um endpoint de tenant-create
- `shared/schema.ts` — companySettings — o wizard popula essa tabela
- `client/src/components/admin/CompanySettingsSection.tsx` — campos existentes que seriam reutilizados no wizard
- Referência de UX: Cal.com onboarding, Calendly setup flow

## Notes

O wizard deve ser stateless entre steps (dados salvos no banco a cada step, não apenas no final) — se o usuário fechar no step 3, retoma de onde parou. Oferecer "import de template de serviços" para empresas de limpeza — categorias e serviços pré-configurados para acelerar o setup.
