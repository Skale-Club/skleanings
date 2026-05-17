# Phase 41: Infra Config - Research

**Researched:** 2026-05-13
**Domain:** DevOps / Infrastructure — Caddy reverse proxy, PM2/systemd, GitHub Actions SSH deploy
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MT-14 | `infra/Caddyfile` with wildcard `*.xkedule.com` + custom tenant domain reverse proxy | Caddy DNS-01 challenge + host matchers research; full config pattern documented |
| MT-15 | `infra/app.service` systemd unit for PM2 or direct Node with EnvironmentFile + restart policy | PM2 systemd startup docs + direct systemd unit pattern documented |
| MT-16 | `.github/workflows/deploy.yml` manual-only `workflow_dispatch` SSH deploy to Hetzner | appleboy/ssh-action pattern documented; no-push-trigger syntax confirmed |
| MT-17 | `infra/README.md` documenting full Hetzner CX23 setup (Node, PM2, Caddy, Cloudflare DNS) | All setup steps researched; sequence documented in Architecture Patterns |
</phase_requirements>

---

## Summary

Phase 41 delivers four infrastructure config files (no TypeScript changes). The critical technical challenge is the Caddy Caddyfile: wildcard TLS for `*.xkedule.com` requires DNS-01 challenge validation, which in turn requires building a custom Caddy binary with the `caddy-dns/cloudflare` module via `xcaddy`. The standard `apt install caddy` binary cannot issue wildcard certificates. This is the single most important thing the planner must know.

The systemd unit file has two viable approaches: (a) a PM2-wrapper service that launches PM2 which then manages the Node process, or (b) a direct `node dist/index.cjs` service with systemd restart policy. The direct approach is simpler and avoids the PM2 systemd layering complexity — recommended given the single-app deployment on CX23.

The GitHub Actions deploy workflow is straightforward using `appleboy/ssh-action@v1`. The critical constraint (MT-16) is `workflow_dispatch` ONLY — no `on: push`. The five existing cron workflows use a different trigger pattern (schedule + workflow_dispatch), so deploy.yml will not conflict structurally.

**Primary recommendation:** One plan covers all four files. Split naturally: Plan 1 = Caddyfile + app.service, Plan 2 = deploy.yml + README.md.

---

## Standard Stack

### Core Tools

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Caddy | 2.x (custom xcaddy build) | Reverse proxy + automatic TLS | Simpler config than nginx, auto HTTPS via Let's Encrypt, wildcard via DNS challenge |
| caddy-dns/cloudflare | latest | DNS-01 challenge for wildcard certs | Required for `*.xkedule.com` wildcard; standard Caddy binary omits DNS providers |
| PM2 | 5.x | Node process manager | Industry standard for Node on Linux; or skip for direct systemd (see below) |
| appleboy/ssh-action | v1 (v1.0.3 as of 2025) | GitHub Actions SSH remote execution | Most-used SSH action; well-maintained; supports Ed25519 keys |
| Node.js | 20 LTS (NodeSource apt repo) | Runtime | Matches project's `npm start` command (`node dist/index.cjs`) |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| xcaddy | latest | Build Caddy with custom modules | Required once during server setup to embed cloudflare DNS provider |
| systemd | Ubuntu built-in | Process supervision | Manages either PM2 or direct Node process |
| ufw | Ubuntu built-in | Firewall | Allow 22, 80, 443 only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom xcaddy build | Caddy Docker image with cloudflare module | Docker adds complexity on bare metal CX23; xcaddy is simpler for direct installs |
| PM2 via systemd | Direct `node` via systemd | Direct is simpler — no double process manager layering; PM2 adds value for multi-process/cluster mode which is not needed here |
| appleboy/ssh-action | Raw SSH via Bash step | Raw SSH requires more boilerplate; appleboy handles key auth, host verification, and multi-host consistently |

---

## Architecture Patterns

### File Layout

```
infra/
├── Caddyfile          # Caddy reverse proxy config (wildcard + custom domains)
├── app.service        # systemd unit file for the Node.js process
└── README.md          # Hetzner CX23 full setup walkthrough

.github/
└── workflows/
    ├── deploy.yml     # NEW: manual SSH deploy (workflow_dispatch only)
    ├── blog-cron.yml          # existing — no conflict
    ├── calendar-sync-cron.yml # existing — no conflict
    ├── booking-email-reminders-cron.yml # existing
    └── recurring-bookings-cron.yml      # existing
```

### Pattern 1: Caddy Wildcard + Custom Domain Routing (Multi-Tenant)

**What:** A single Caddy site block matches `*.xkedule.com`. Unrecognized subdomains are aborted (Caddy returns no response). Custom tenant domains are listed as additional site addresses in the same block, or in separate blocks that also proxy to localhost:5000.

**When to use:** Always — this is the only valid pattern for wildcard TLS with DNS challenge on Caddy.

**The key insight:** Caddy's `*.xkedule.com` site address + DNS challenge means the app itself resolves tenant from hostname (Phase 40's `resolveTenantMiddleware`). Caddy does NOT need to know about individual tenants — it proxies everything to `localhost:5000` and the Node app handles tenant dispatch.

```caddyfile
# Source: https://caddyserver.com/docs/caddyfile/patterns
{
    # Global options
    email admin@xkedule.com
}

# Wildcard subdomain block — covers *.xkedule.com
*.xkedule.com {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy localhost:5000
}

# Custom tenant domains — each added as a separate block
# (operators add one block per custom domain; no Caddy restart needed with `caddy reload`)
# Example:
# cleaning.tenantcustomdomain.com {
#     reverse_proxy localhost:5000
# }
```

**Why custom domains work without wildcard cert:** Each custom domain (`cleaning.example.com`) gets its own Let's Encrypt certificate automatically via Caddy's HTTP-01 challenge. No DNS plugin needed for custom domains — only the `*.xkedule.com` wildcard requires DNS-01.

**Custom domain scalability note:** The Caddyfile approach requires a manual `caddy reload` per new custom domain. For v8.0 this is acceptable; dynamic domain routing via Caddy API is a v9.0 concern.

### Pattern 2: systemd Direct Node Unit (Recommended Over PM2 Wrapper)

**What:** A systemd unit that starts `node /var/www/skleanings/dist/index.cjs` directly, loads env vars from `EnvironmentFile=/etc/skleanings/.env`, and restarts on failure.

**Why prefer over PM2:** PM2 + systemd creates two process managers layered together. For a single-app CX23 deployment, systemd alone provides restart-on-failure, log capture via journald, and boot start — everything PM2 adds for this use case. Simpler operational model.

```ini
# Source: systemd unit patterns (https://www.cloudbees.com/blog/running-node-js-linux-systemd)
[Unit]
Description=Skleanings Node.js App
After=network.target

[Service]
Type=simple
User=skleanings
WorkingDirectory=/var/www/skleanings
EnvironmentFile=/etc/skleanings/.env
ExecStart=/usr/bin/node dist/index.cjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=skleanings

[Install]
WantedBy=multi-user.target
```

**Why `Type=simple`:** The Node process does not fork — it stays in the foreground. `simple` is correct. `forking` is for processes that daemonize themselves (PM2 without --no-daemon, nginx, etc.).

**App start command:** `npm start` runs `cross-env NODE_ENV=production node dist/index.cjs`. The systemd unit sets `NODE_ENV=production` via EnvironmentFile and calls `node dist/index.cjs` directly (avoiding the `cross-env` npm dependency in the systemd exec path).

**Port:** The app listens on `process.env.PORT || 5000`. EnvironmentFile should include `PORT=5000` unless Caddy is pointed at a different port.

### Pattern 3: GitHub Actions workflow_dispatch SSH Deploy

**What:** A manually-triggered workflow that SSHes to the Hetzner VM and runs the deploy sequence: `git pull && npm ci && npm run build && systemctl restart skleanings`.

**Critical constraint (MT-16):** `on:` block contains ONLY `workflow_dispatch`. No `push`, no `schedule`. This is intentional — production deploys require human approval.

```yaml
# Source: https://github.com/appleboy/ssh-action
name: Deploy to Hetzner

on:
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for this deployment'
        required: false
        default: 'Manual deploy'

jobs:
  deploy:
    name: SSH Deploy
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: ${{ secrets.HETZNER_USER }}
          key: ${{ secrets.HETZNER_SSH_KEY }}
          port: 22
          script: |
            cd /var/www/skleanings
            git pull origin main
            npm ci --production=false
            npm run build
            sudo systemctl restart skleanings
            echo "Deploy complete at $(date -u)"
```

**GitHub Secrets required:**
- `HETZNER_SSH_KEY` — private key (Ed25519 recommended); matching public key in `~/.ssh/authorized_keys` on server
- `HETZNER_HOST` — IP address or hostname of Hetzner VM
- `HETZNER_USER` — Linux user on Hetzner VM (e.g., `deploy` or `skleanings`)

**npm ci vs npm install:** `npm ci` is correct for deploys — it installs exact locked versions from `package-lock.json`, fails on lockfile drift, and is faster than `npm install`. Use `--production=false` to include devDependencies needed for `npm run build` (vite, esbuild, etc.).

**sudo for systemctl:** The deploy user needs passwordless sudo for `systemctl restart skleanings` only. Add to sudoers: `skleanings ALL=(ALL) NOPASSWD: /bin/systemctl restart skleanings`.

### Pattern 4: Hetzner CX23 Setup Sequence (for README)

The README must document this exact sequence so operators can reproduce the server from scratch:

1. **Initial server setup** — SSH in as root, create deploy user, configure ufw (22, 80, 443)
2. **Node.js 20 LTS** — via NodeSource apt repo (not `apt install nodejs` which gives old version)
3. **Install xcaddy** — build custom Caddy binary with cloudflare DNS module
4. **Configure Caddy** — copy `infra/Caddyfile` to `/etc/caddy/Caddyfile`, set `CLOUDFLARE_API_TOKEN` env
5. **Configure app** — clone repo to `/var/www/skleanings`, create `/etc/skleanings/.env`
6. **Install systemd unit** — copy `infra/app.service` to `/etc/systemd/system/skleanings.service`, enable + start
7. **Cloudflare DNS** — add `*.xkedule.com` CNAME → Hetzner IP in Cloudflare dashboard; set proxy mode (orange cloud) for DDoS protection
8. **GitHub Secrets** — add `HETZNER_SSH_KEY`, `HETZNER_HOST`, `HETZNER_USER` to repo secrets

### Anti-Patterns to Avoid

- **Using standard `apt install caddy`:** This binary has no DNS provider plugins. Wildcard certs will silently fail the ACME challenge. Must use xcaddy.
- **Setting `on: push` on deploy.yml:** Violates MT-16. Automates deploys to production on every commit — dangerous for a multi-tenant platform.
- **Cloudflare "Full (strict)" SSL mode with Caddy managing certs:** Causes cert chain conflicts. Use "Full" (not strict) or "Flexible" when Caddy handles TLS. Actually: with Caddy managing valid Let's Encrypt certs, "Full (strict)" works correctly — but operators must verify Cloudflare SSL mode matches.
- **`Type=forking` in systemd unit:** Node doesn't fork. `forking` will cause systemd to think the process failed to start. Use `Type=simple`.
- **Storing `.env` in the git repo:** The `/etc/skleanings/.env` file lives on the server only, never committed. The README must make this explicit.
- **`npm install` instead of `npm ci` in deploy script:** `npm install` can silently upgrade packages; `npm ci` fails on lockfile drift, ensuring reproducible deploys.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wildcard TLS cert issuance | Custom ACME client | Caddy + caddy-dns/cloudflare | DNS-01 challenge, renewal, cert storage all handled automatically |
| SSH deploy runner | Custom Python/Bash webhook | appleboy/ssh-action@v1 | Handles key auth, known hosts, multi-command scripts, timeout |
| Process resurrection on crash | Custom watchdog script | systemd `Restart=always` | Kernel-level; survives OOM kills and segfaults that userland watchers miss |
| Custom domain TLS | Manual certbot per domain | Caddy automatic HTTP-01 | Caddy issues + renews per-domain certs automatically on first request |

---

## Common Pitfalls

### Pitfall 1: Standard Caddy Binary Cannot Issue Wildcard Certs

**What goes wrong:** Operator runs `apt install caddy`, puts `*.xkedule.com` in Caddyfile with `tls { dns cloudflare ... }` — Caddy logs an error that the dns.providers.cloudflare module is not found. HTTP-01 challenge is then attempted for `*.xkedule.com`, which always fails (wildcards require DNS-01).

**Why it happens:** The official Caddy apt package is a vanilla build. DNS provider modules are third-party plugins that must be compiled in.

**How to avoid:** README must include xcaddy install + build step BEFORE copying Caddyfile. The built binary replaces the system caddy binary: `sudo cp caddy /usr/bin/caddy`.

**Warning signs:** `caddy run` or `systemctl start caddy` logs mentioning "unrecognized module" or "dns provider not found".

### Pitfall 2: Cloudflare Proxy (Orange Cloud) Blocking Direct TLS Challenge

**What goes wrong:** Caddy's DNS-01 challenge creates a TXT record (`_acme-challenge.xkedule.com`). This works regardless of Cloudflare proxy status. However, if the operator sets the wildcard `*.xkedule.com` DNS record to "DNS only" (grey cloud), traffic goes directly to Hetzner IP — exposing the server IP, bypassing DDoS protection.

**How to avoid:** README should specify setting `*.xkedule.com` CNAME/A record as proxied (orange cloud). DNS-01 challenge is unaffected by proxy mode since it uses TXT records, not HTTP traffic.

### Pitfall 3: EnvironmentFile Syntax Differs from Shell .env

**What goes wrong:** `/etc/skleanings/.env` written with `export KEY=value` or with quotes causes systemd to fail parsing — systemd EnvironmentFile does NOT support `export`, shell substitutions, or quoted multi-word values with spaces.

**How to avoid:** README must specify bare `KEY=value` format without `export`, without quotes (unless the value actually contains spaces), one entry per line. Comments (`# ...`) are allowed.

**Warning signs:** `systemctl status skleanings` shows "Failed to load environment files".

### Pitfall 4: Node Path in systemd ExecStart

**What goes wrong:** ExecStart uses `node` but systemd runs with a minimal PATH. Node installed via NodeSource apt is at `/usr/bin/node`. If Node was installed via nvm, the path is `~/.nvm/...` and will not be found by systemd.

**How to avoid:** Use NodeSource apt repo installation (not nvm) for production. Use absolute path `/usr/bin/node` in ExecStart. Verify with `which node` after install.

### Pitfall 5: deploy.yml Uses npm ci But Build Fails Without devDependencies

**What goes wrong:** `npm ci --omit=dev` (or `npm ci --production`) skips devDependencies — but `npm run build` needs vite and esbuild (which are devDependencies). Build step fails with "vite: command not found".

**How to avoid:** Use `npm ci` without `--omit=dev` or `--production` flag in the deploy script. After build, devDependencies are already installed and the built artifact (`dist/`) is what runs in production.

---

## Code Examples

### Caddyfile — Complete Multi-Tenant Pattern

```caddyfile
# /etc/caddy/Caddyfile
# Source: https://caddyserver.com/docs/caddyfile/patterns

{
    email admin@xkedule.com
}

# Wildcard subdomain block — *.xkedule.com
# Requires xcaddy build with caddy-dns/cloudflare module
# Requires CLOUDFLARE_API_TOKEN env var with Zone > DNS > Edit permission
*.xkedule.com {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy localhost:5000
}

# Custom tenant domain example (one block per custom domain)
# Caddy issues HTTP-01 cert automatically — no DNS plugin needed here
# customdomain.com {
#     reverse_proxy localhost:5000
# }
```

### systemd Unit — Direct Node (app.service)

```ini
# /etc/systemd/system/skleanings.service
# Source: systemd documentation patterns

[Unit]
Description=Skleanings Multi-Tenant Booking Platform
After=network.target

[Service]
Type=simple
User=skleanings
Group=skleanings
WorkingDirectory=/var/www/skleanings
EnvironmentFile=/etc/skleanings/.env
ExecStart=/usr/bin/node dist/index.cjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=skleanings

[Install]
WantedBy=multi-user.target
```

### GitHub Actions Deploy Workflow (deploy.yml)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Hetzner

on:
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for this deployment'
        required: false
        default: 'Manual deploy'

jobs:
  deploy:
    name: SSH Deploy to Hetzner CX23
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: ${{ secrets.HETZNER_USER }}
          key: ${{ secrets.HETZNER_SSH_KEY }}
          port: 22
          script: |
            set -e
            cd /var/www/skleanings
            git pull origin main
            npm ci
            npm run build
            sudo systemctl restart skleanings
            echo "Deploy complete at $(date -u)"
```

### /etc/skleanings/.env Format

```bash
# /etc/skleanings/.env — loaded by systemd EnvironmentFile
# NO 'export' prefix. NO shell substitutions. Bare KEY=value only.
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/db
SESSION_SECRET=long-random-string
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=$2b$10$...
SUPER_ADMIN_EMAIL=superadmin@xkedule.com
SUPER_ADMIN_PASSWORD_HASH=$2b$10$...
CLOUDFLARE_API_TOKEN=cf_token_here
```

### Node.js 20 LTS Install via NodeSource

```bash
# Source: https://computingforgeeks.com/how-to-install-node-js-20-on-ubuntu/
NODE_MAJOR=20
sudo apt-get install -y ca-certificates curl gnupg
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] \
  https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update && sudo apt-get install -y nodejs
node --version  # should output v20.x.x
```

### xcaddy Build with Cloudflare DNS Module

```bash
# Source: https://github.com/caddy-dns/cloudflare
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/xcaddy/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-xcaddy-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/xcaddy/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-xcaddy.list
sudo apt update && sudo apt install xcaddy
xcaddy build --with github.com/caddy-dns/cloudflare
sudo cp caddy /usr/bin/caddy
caddy version  # verify
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nginx + certbot for TLS | Caddy with automatic ACME | ~2020 | No certbot cron, no nginx TLS config; Caddy handles renewal |
| PM2 as primary supervisor | systemd as supervisor (PM2 optional) | ~2018 | systemd is more robust; PM2 still common but not required |
| `npm install` in CI deploy | `npm ci` | npm 5.7+ (2017) | Deterministic, fast, fails on lockfile drift |
| `on: push` auto-deploys | `workflow_dispatch` manual only | Always best practice | Prevents accidental production deploys from feature branches |

---

## Environment Availability

> This phase produces config files to be copied to the server during setup — it does not require any of these tools on the developer's local machine. The README instructs the server operator to install them on the Hetzner VM.

| Dependency | Required By | Available (server) | Version | Fallback |
|------------|------------|-------------------|---------|----------|
| Ubuntu 22.04 | All infra | Target OS | 22.04 LTS | — |
| Node.js 20 LTS | app.service ExecStart | Installed via README steps | 20.x | — |
| xcaddy + Caddy | Caddyfile wildcard TLS | Installed via README steps | 2.x | Cannot issue wildcard certs without it |
| Cloudflare API Token | Caddy DNS challenge | Operator-provisioned | — | No fallback — required for wildcard |
| GitHub Secrets (3) | deploy.yml | Operator-configured | — | Deploy workflow fails without these |

**Missing dependencies with no fallback:**
- `CLOUDFLARE_API_TOKEN` with Zone > DNS > Edit permission — required for `*.xkedule.com` wildcard cert; no HTTP challenge alternative exists for wildcards.
- Three GitHub Secrets (`HETZNER_SSH_KEY`, `HETZNER_HOST`, `HETZNER_USER`) — deploy.yml fails if absent.

---

## Open Questions

1. **Custom domain TLS approach: HTTP-01 vs operator-managed**
   - What we know: Caddy auto-issues certs via HTTP-01 for non-wildcard custom domains; this requires port 80 reachable
   - What's unclear: Should the Caddyfile include a commented-out example custom domain block, or a note about using Caddy's API to add domains dynamically?
   - Recommendation: Include one commented-out example block in the Caddyfile for v8.0; dynamic API approach is v9.0 work (per REQUIREMENTS.md Future Requirements)

2. **App user permissions for systemctl restart**
   - What we know: The deploy workflow runs `sudo systemctl restart skleanings` — requires passwordless sudo for that specific command
   - What's unclear: Whether the deploy user and the app service user are the same or different
   - Recommendation: Use a single `skleanings` user for both; add `skleanings ALL=(ALL) NOPASSWD: /bin/systemctl restart skleanings` to sudoers — document in README

3. **Cloudflare SSL mode compatibility**
   - What we know: Caddy issues valid Let's Encrypt certs; Cloudflare proxying (orange cloud) should use "Full" or "Full (strict)" mode
   - What's unclear: Current Cloudflare SSL mode for xkedule.com is unknown
   - Recommendation: README should document checking/setting Cloudflare SSL to "Full (strict)" when Caddy is managing valid certs

---

## Validation Architecture

> This phase produces only config files (Caddyfile, systemd unit, YAML, README) — no TypeScript/Express code. There is no automated test framework applicable. Validation is structural (file exists, syntax valid) and manual (deploy smoke test).

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MT-14 | `infra/Caddyfile` exists and has wildcard block | structural | `test -f infra/Caddyfile && grep -q '*.xkedule.com' infra/Caddyfile` | ❌ Wave 0 |
| MT-15 | `infra/app.service` exists and has EnvironmentFile directive | structural | `test -f infra/app.service && grep -q EnvironmentFile infra/app.service` | ❌ Wave 0 |
| MT-16 | `deploy.yml` exists with workflow_dispatch ONLY (no push trigger) | structural | `test -f .github/workflows/deploy.yml && grep -q workflow_dispatch .github/workflows/deploy.yml && ! grep -q 'on:.*push' .github/workflows/deploy.yml` | ❌ Wave 0 |
| MT-17 | `infra/README.md` exists and covers key setup sections | structural | `test -f infra/README.md && grep -q 'xcaddy' infra/README.md && grep -q 'Cloudflare' infra/README.md` | ❌ Wave 0 |

### Sampling Rate

- **Per task:** Shell one-liner above (< 2 seconds)
- **Phase gate:** All four files present + `caddy fmt --diff infra/Caddyfile` reports no errors (requires caddy installed locally, optional) + `yamllint .github/workflows/deploy.yml` (optional)
- **Full validation:** Human operator follows README on actual Hetzner CX23 (v9.0 deployment milestone)

### Wave 0 Gaps

- [ ] All four files to be created: `infra/Caddyfile`, `infra/app.service`, `.github/workflows/deploy.yml`, `infra/README.md`

*(No existing test infrastructure; all files created from scratch in this phase)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on This Phase |
|-----------|---------------------|
| App listens on `PORT` env var (default 5000) | Caddy `reverse_proxy localhost:5000`; EnvironmentFile must set `PORT=5000` |
| `npm run build` → `dist/index.cjs` (CJS bundle) | systemd ExecStart: `node dist/index.cjs` |
| `npm run start` = `cross-env NODE_ENV=production node dist/index.cjs` | EnvironmentFile sets `NODE_ENV=production`; ExecStart calls node directly |
| Session cookie `secure: true` in production | Requires HTTPS — Caddy provides this; no app change needed |
| Required env vars: DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH | All must appear in `/etc/skleanings/.env` template in README |

---

## Sources

### Primary (HIGH confidence)
- [Caddy Caddyfile Patterns](https://caddyserver.com/docs/caddyfile/patterns) — wildcard subdomain pattern confirmed
- [Caddy TLS directive docs](https://caddyserver.com/docs/caddyfile/directives/tls) — DNS challenge syntax confirmed
- [caddy-dns/cloudflare GitHub](https://github.com/caddy-dns/cloudflare) — xcaddy build command confirmed
- [appleboy/ssh-action GitHub](https://github.com/appleboy/ssh-action) — workflow YAML syntax confirmed
- [PM2 Startup docs](https://pm2.keymetrics.io/docs/usage/startup/) — systemd integration confirmed

### Secondary (MEDIUM confidence)
- [DigitalOcean: Node.js Production on Ubuntu 22.04](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-22-04) — PM2 + systemd patterns
- [CloudBees: Running Node.js with systemd](https://www.cloudbees.com/blog/running-node-js-linux-systemd) — direct systemd unit patterns
- [Hetzner CX23 deployment guide](https://medium.com/@aamirkgigyani/hetzner-vps-deployment-guide-next-js-node-js-with-pm2-nginx-and-certbot-5d495bbe1028) — setup sequence reference (uses nginx/certbot, adapted to Caddy)
- [NodeSource Node 20 install](https://computingforgeeks.com/how-to-install-node-js-20-on-ubuntu/) — apt repo install commands

### Tertiary (LOW confidence — no additional verification)
- General systemd EnvironmentFile behavior — well-established Linux practice, HIGH confidence in practice even without a specific citation

---

## Metadata

**Confidence breakdown:**
- Caddyfile patterns: HIGH — verified against official Caddy docs
- xcaddy requirement for wildcard: HIGH — confirmed by Caddy docs and caddy-dns/cloudflare README
- systemd unit structure: HIGH — standard Linux systemd; direct node approach well-documented
- appleboy/ssh-action syntax: HIGH — verified against official GitHub repo README
- Hetzner-specific setup sequence: MEDIUM — inferred from general Ubuntu VPS patterns; CX23-specific docs are sparse

**Research date:** 2026-05-13
**Valid until:** 2026-08-13 (Caddy DNS module APIs are stable; GitHub Actions action versions may update)
