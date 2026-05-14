# Requirements — v11.0 Password Reset

**Milestone:** v11.0 Password Reset
**Goal:** Tenant admins conseguem recuperar o acesso à conta via link enviado por email — sem depender do super-admin para re-provisionar credenciais.
**Status:** Active

---

## Milestone Requirements

### Reset Flow (Phase 47)

- [ ] **PR-01**: Admin envia seu email em `POST /api/auth/forgot-password` — se o email existe na tabela `users` para o tenant atual, um token de reset é gerado e enviado via Resend; se não existe, responde com 200 mesmo (sem revelar se email existe)
- [ ] **PR-02**: Token de reset é armazenado na tabela `password_reset_tokens` (userId, token hash, expiresAt, usedAt) — token expira em 1 hora
- [ ] **PR-03**: Admin clica no link do email → `GET /reset-password?token=...` no frontend — formulário para nova senha
- [ ] **PR-04**: Admin submete nova senha em `POST /api/auth/reset-password` com o token — token validado (existe, não expirado, não usado), senha atualizada com bcrypt, token marcado como usado

### Admin Self-Service (Phase 47)

- [ ] **PR-05**: Admin logado pode trocar a própria senha em `POST /api/auth/change-password` (senha atual + nova senha) — sem precisar de reset por email
- [ ] **PR-06**: Email de reset usa o template Resend existente (`server/lib/email-resend.ts`) com branding do tenant (company name do companySettings)

---

## Future Requirements

- Rate limiting no endpoint `/api/auth/forgot-password` para evitar spam de emails
- Expiração e limpeza automática de tokens expirados via cron
- Notificação de segurança quando senha é alterada

## Out of Scope

| Feature | Reason |
|---------|--------|
| Magic link login (passwordless) | Sessão+bcrypt é o padrão do projeto |
| SMS reset | Twilio existe mas não é o canal primário |
| Admin pode ver/gerenciar outros admins | Escopo de IAM — v12.0+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PR-01 | Phase 47 | Pending |
| PR-02 | Phase 47 | Pending |
| PR-03 | Phase 47 | Pending |
| PR-04 | Phase 47 | Pending |
| PR-05 | Phase 47 | Pending |
| PR-06 | Phase 47 | Pending |

**Coverage:**
- v1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 after initial definition*
