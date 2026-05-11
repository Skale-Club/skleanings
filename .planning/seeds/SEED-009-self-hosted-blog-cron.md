---
id: SEED-009
status: dormant
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: ao migrar para Xkedule (Hetzner — sem Vercel Cron disponível)
scope: Small
---

# SEED-009: Blog generation cron via GitHub Actions (substituir Vercel Cron)

## Why This Matters

A geração automática de blog posts hoje depende do **Vercel Cron**, que só funciona enquanto o app rodar no Vercel. Quando o Xkedule migrar para Hetzner + Caddy (padrão do skaleclub-websites — ver memória de arquitetura), o Vercel Cron deixa de existir.

A solução é **GitHub Actions com `schedule:` cron** disparando o endpoint `POST /api/blog/generate` via HTTP request autenticado. GH Actions é gratuito para repos privados (até certo limite), zero infra extra, e o YAML do schedule fica versionado no próprio repo.

**Why:** Migração para Hetzner sem substituir o Vercel Cron significa blog para de gerar posts no dia da migração. Precisa ter o substituto pronto antes do cutover.

## When to Surface

**Trigger:** ao iniciar a migração de Vercel para Hetzner (parte de SEED-013 ou milestone separada de infra). Antes do cutover do DNS.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone de infra Xkedule (Hetzner + Caddy)
- Milestone de migração de deploy

## Scope Estimate

**Small** — Algumas horas. Componentes:

1. **GitHub Actions workflow** `.github/workflows/blog-cron.yml`:
   ```yaml
   on:
     schedule:
       - cron: '0 9 * * *'  # 9h UTC todo dia
     workflow_dispatch:      # botão manual no GitHub
   jobs:
     trigger-blog-generation:
       runs-on: ubuntu-latest
       steps:
         - run: |
             curl -X POST https://xkedule.com/api/blog/generate \
               -H "Authorization: Bearer ${{ secrets.BLOG_CRON_TOKEN }}" \
               -H "X-Tenant-Id: ${{ matrix.tenant }}" \
               --fail
   ```

2. **Backend:**
   - Endpoint `POST /api/blog/generate` autenticado por bearer token (BLOG_CRON_TOKEN)
   - Para Xkedule multi-tenant: workflow itera sobre tenants com `blogSettings.enabled = true` (via matrix strategy do GH Actions ou via endpoint que processa todos os tenants)
   - Mecanismo de lock atual (`blogGenerationJobs.lockedAt`) continua válido

3. **Remoção:**
   - Remover `vercel.json` cron config
   - Remover tabela `systemHeartbeats` (keep-alive era para Vercel — não precisa em GH Actions)

## Breadcrumbs

- `vercel.json` — config atual de cron
- `server/routes.ts` — endpoint `POST /api/blog/generate`
- `shared/schema.ts` — tabelas `blogGenerationJobs`, `systemHeartbeats` (remove esta última)
- Padrão de referência: `.github/workflows/deploy.yml` do skaleclub-websites — secrets, autenticação
- GH Actions cron: limite mínimo é 5min (não 1min); blog geração diária está bem dentro do limite

## Notes

**Por que GH Actions em vez de node-cron in-process:** Quando o app rodar em múltiplas instâncias no Hetzner (PM2 cluster mode, ou múltiplos pods), node-cron dispara N vezes uma em cada instância. GH Actions garante exatamente 1 execução por agendamento.

**Autenticação:** `BLOG_CRON_TOKEN` é um secret no GitHub Actions e uma env var no servidor. Endpoint só aceita requests com esse header. Sem isso, qualquer pessoa pode disparar geração de blog (custo OpenRouter).

**Para Xkedule multi-tenant:** uma estratégia é o endpoint receber tenantId e processar um por vez (workflow matrix com lista de tenants). Outra é o endpoint sem tenant que itera internamente todos os tenants com blog habilitado. Decidir no planning baseado em volume.
