# Requirements — v10.0 Tenant Admin Auth

**Milestone:** v10.0 Tenant Admin Auth
**Goal:** Admins provisionados pela super-admin conseguem fazer login no painel `/admin` do seu tenant usando as credenciais geradas — o loop de onboarding está completo.
**Status:** Active

---

## Milestone Requirements

### Tenant Admin Login (Phase 45)

- [ ] **TA-01**: Tenant admin pode fazer login em `POST /api/auth/tenant-login` com email + senha — session criada com `req.session.adminUser` scoped ao tenantId do tenant atual (via `res.locals.tenant.id`)
- [ ] **TA-02**: Tentativa de login com senha errada ou email desconhecido retorna 401 timing-safe (bcrypt.compare sempre executa para evitar timing attack)
- [ ] **TA-03**: Sessão persiste entre refreshes do browser — admin permanece logado sem reautenticar
- [x] **TA-04**: Admin pode fazer logout via `POST /api/auth/logout` — sessão destruída, redirect para login

### Session Scoping (Phase 45)

- [ ] **TA-05**: `requireAdmin` middleware valida que `req.session.adminUser.tenantId === res.locals.tenant.id` — admin do tenant 1 não consegue acessar rotas do tenant 2
- [ ] **TA-06**: O path de login legado (env vars `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`) continua funcional para tenant 1 (Skleanings) — compatibilidade backward mantida

### Admin Panel Access (Phase 46)

- [ ] **TA-07**: Após login, o admin do tenant 2 consegue acessar `/admin` e vê os dados do seu tenant (bookings, services, staff, company settings) — todos via `res.locals.storage` do tenant correto
- [ ] **TA-08**: Rotas protegidas por `requireAdmin` retornam 401 quando não há sessão ativa — o painel frontend redireciona para login
- [ ] **TA-09**: Admin panel frontend detecta o tenant correto pelo hostname — `useAuth` hook sabe que está num tenant específico, não no tenant 1 hardcoded

---

## Future Requirements

- Recuperação de senha por email (reset link via Resend) — pós v10.0
- Perfil do admin (trocar email/senha) — pós v10.0
- Role-based access control dentro do tenant (admin vs viewer) — pós v10.0
- OAuth/SSO por tenant — muito posterior

## Out of Scope

| Feature | Reason |
|---------|--------|
| Self-serve signup de tenant admins | Requer billing e aprovação do super-admin |
| Recuperação de senha | Requer Resend config por tenant — v11.0 |
| 2FA | Não prioritário para MVP multi-tenant |
| JWT tokens | Session-based é o padrão do projeto — não quebrar |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TA-01 | Phase 45 | Pending |
| TA-02 | Phase 45 | Pending |
| TA-03 | Phase 45 | Pending |
| TA-04 | Phase 45 | Complete |
| TA-05 | Phase 45 | Pending |
| TA-06 | Phase 45 | Pending |
| TA-07 | Phase 46 | Pending |
| TA-08 | Phase 46 | Pending |
| TA-09 | Phase 46 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 after initial definition*
