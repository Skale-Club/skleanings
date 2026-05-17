---
phase: 41
plan: 02
subsystem: infra
tags: [devops, github-actions, hetzner, caddy, systemd, documentation]
dependency_graph:
  requires: [41-01]
  provides: [MT-16, MT-17]
  affects: []
tech_stack:
  added: []
  patterns: [workflow_dispatch-only deploy, xcaddy DNS-01 wildcard TLS, systemd EnvironmentFile]
key_files:
  created:
    - .github/workflows/deploy.yml
    - infra/README.md
  modified: []
decisions:
  - "[41-02]: deploy.yml uses workflow_dispatch only (no push trigger) per MT-16 — prevents accidental production deploys from feature branches"
  - "[41-02]: npm ci without --omit=dev in deploy script — devDependencies (vite, esbuild) required for npm run build"
  - "[41-02]: README documents NodeSource apt install (not nvm) for Node.js — systemd ExecStart requires absolute /usr/bin/node path"
metrics:
  duration_seconds: 102
  completed_date: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
requirements_satisfied:
  - MT-16
  - MT-17
---

# Phase 41 Plan 02: Deploy Workflow and Infra README Summary

**One-liner:** Manual-only GitHub Actions SSH deploy workflow (`workflow_dispatch`) and complete Hetzner CX23 operator setup guide covering xcaddy wildcard TLS, systemd, and Cloudflare DNS.

## What Was Built

### Task 1: .github/workflows/deploy.yml (MT-16)

Created a manually-triggered GitHub Actions workflow for SSH deployment to Hetzner. The `on:` block contains only `workflow_dispatch` — no `push` or `schedule` triggers. The workflow uses `appleboy/ssh-action@v1` with three GitHub Secrets (`HETZNER_HOST`, `HETZNER_USER`, `HETZNER_SSH_KEY`) and runs a `set -e` deploy script: `git pull origin main`, `npm ci`, `npm run build`, `sudo systemctl restart skleanings`. The 10-minute timeout prevents hung deployments.

### Task 2: infra/README.md (MT-17)

Created a complete Hetzner CX23 server setup guide covering 8 ordered steps:

1. Initial server setup (user creation, passwordless sudo for systemctl, ufw firewall rules)
2. Node.js 20 LTS via NodeSource apt repository (not apt install nodejs, not nvm)
3. xcaddy build with `caddy-dns/cloudflare` module (required for `*.xkedule.com` wildcard cert)
4. Caddy configuration (copy Caddyfile, create caddy.env with CLOUDFLARE_API_TOKEN, EnvironmentFile in systemd unit)
5. Clone repository and configure `/etc/skleanings/.env` (bare KEY=value format, bcrypt hash generation)
6. Install systemd service unit (`infra/app.service`)
7. Cloudflare DNS (wildcard A record, root A record, Full strict SSL mode)
8. GitHub Secrets configuration and deploy trigger instructions

Includes a 6-row troubleshooting table covering the most common setup failures.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b4c307f | feat(41-02): add manual-only GitHub Actions deploy workflow for Hetzner |
| 2 | 7e08a31 | feat(41-02): add Hetzner CX23 server setup guide (MT-17) |

## Verification

```
MT-16: deploy.yml OK
MT-17: README.md OK
```

Both plan verification checks passed.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `.github/workflows/deploy.yml` exists: FOUND
- `infra/README.md` exists: FOUND
- Commit b4c307f: FOUND
- Commit 7e08a31: FOUND
