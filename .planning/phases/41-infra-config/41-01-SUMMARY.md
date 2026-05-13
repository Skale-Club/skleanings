---
phase: 41-infra-config
plan: "01"
subsystem: infra
tags: [caddy, systemd, multi-tenant, hetzner, deployment]
dependency_graph:
  requires: [40-tenant-resolution-middleware]
  provides: [infra/Caddyfile, infra/app.service]
  affects: []
tech_stack:
  added: [Caddy (xcaddy build with caddy-dns/cloudflare), systemd unit]
  patterns: [DNS-01 ACME challenge for wildcard TLS, direct Node.js systemd service]
key_files:
  created:
    - infra/Caddyfile
    - infra/app.service
  modified: []
decisions:
  - "DNS-01 via Cloudflare API for wildcard *.xkedule.com TLS (HTTP-01 cannot issue wildcard certs)"
  - "Direct node systemd unit (Type=simple) over PM2 wrapper — simpler for single-app CX23 deployment"
  - "CLOUDFLARE_API_TOKEN read from env at Caddy startup via {env.CLOUDFLARE_API_TOKEN} — never hardcoded"
metrics:
  duration: "55s"
  completed_date: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 41 Plan 01: Infra Config — Caddyfile + systemd Unit Summary

Caddy wildcard reverse proxy config for `*.xkedule.com` using Cloudflare DNS-01 challenge, plus a systemd service unit running Node directly with `Restart=always` and env file loading.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create infra/Caddyfile (MT-14) | 8f85391 | infra/Caddyfile |
| 2 | Create infra/app.service (MT-15) | 0b678a2 | infra/app.service |

## What Was Built

### infra/Caddyfile
- Global email directive for ACME registration (`admin@xkedule.com`)
- `*.xkedule.com` site block with `tls { dns cloudflare {env.CLOUDFLARE_API_TOKEN} }` for DNS-01 wildcard certificate issuance
- `reverse_proxy localhost:5000` — all traffic forwarded to Node; tenant dispatch handled by Phase 40 middleware
- Commented-out example custom tenant domain block (HTTP-01 cert, no DNS plugin needed)
- Header comment explaining xcaddy requirement — standard `apt install caddy` cannot issue wildcard certs

### infra/app.service
- `[Unit]` with `After=network.target`
- `[Service]` with `Type=simple`, `User=skleanings`, `Group=skleanings`
- `WorkingDirectory=/var/www/skleanings`
- `EnvironmentFile=/etc/skleanings/.env` — bare KEY=value env loading
- `ExecStart=/usr/bin/node dist/index.cjs` — absolute path required for systemd minimal PATH
- `Restart=always`, `RestartSec=5` — automatic recovery from crashes
- `StandardOutput=journal`, `StandardError=journal`, `SyslogIdentifier=skleanings` — journald integration
- `[Install]` with `WantedBy=multi-user.target`

## Verification Results

```
MT-14: Caddyfile OK
MT-15: app.service OK
```

## Decisions Made

1. **DNS-01 Cloudflare for wildcard TLS:** HTTP-01 ACME challenge cannot validate wildcard certificates. DNS-01 via Cloudflare API is the only viable approach for `*.xkedule.com`. Requires xcaddy build with `caddy-dns/cloudflare`.

2. **Direct Node systemd (not PM2):** PM2 + systemd creates two layered process managers. For a single-app CX23 deployment, systemd `Restart=always` provides equivalent functionality without the operational complexity. PM2 remains an option documented in RESEARCH.md.

3. **`{env.CLOUDFLARE_API_TOKEN}` syntax:** Caddy reads the token from the server environment at startup. The token is never stored in the Caddyfile itself — it lives in Caddy's environment (set by the operator, separate from the app's EnvironmentFile).

## Requirements Satisfied

- MT-14: `infra/Caddyfile` with wildcard `*.xkedule.com` + Cloudflare DNS-01 reverse proxy
- MT-15: `infra/app.service` systemd unit with `EnvironmentFile`, `Restart=always`, direct node ExecStart

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — these are complete, deployable config files. No data sources, no placeholder values beyond the commented-out custom domain example (which is intentional documentation).

## Self-Check: PASSED

- [x] `infra/Caddyfile` exists and contains `*.xkedule.com`, `dns cloudflare`, `reverse_proxy localhost:5000`
- [x] `infra/app.service` exists and contains `Type=simple`, `EnvironmentFile=/etc/skleanings/.env`, `ExecStart=/usr/bin/node dist/index.cjs`, `Restart=always`
- [x] Commit 8f85391 exists (Caddyfile)
- [x] Commit 0b678a2 exists (app.service)
