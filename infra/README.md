# Hetzner CX23 Server Setup Guide

This guide covers every step to bring a fresh Hetzner CX23 server from bare Ubuntu 22.04 to a running Skleanings deployment. Follow these steps in order. An operator unfamiliar with the codebase should be able to complete setup using only this document.

## Server Overview

- **Server:** Hetzner CX23 (2 vCPU, 4 GB RAM, Ubuntu 22.04 LTS)
- **Domain:** `*.xkedule.com` (wildcard) + custom tenant domains
- **Reverse Proxy:** Caddy (custom xcaddy build with Cloudflare DNS module)
- **Process Manager:** systemd (direct Node.js, no PM2)
- **Node Version:** 20 LTS

## Step 1: Initial Server Setup

SSH into the server as root, then create the `skleanings` deploy/app user:

```bash
# Create the skleanings user
adduser skleanings
usermod -aG sudo skleanings

# Configure passwordless sudo for systemctl restart only
echo 'skleanings ALL=(ALL) NOPASSWD: /bin/systemctl restart skleanings' \
  | sudo tee /etc/sudoers.d/skleanings
chmod 440 /etc/sudoers.d/skleanings

# Configure firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

All remaining steps should be run as the `skleanings` user unless noted otherwise:

```bash
su - skleanings
```

## Step 2: Install Node.js 20 LTS

> **Important:** Do NOT use `apt install nodejs` — the Ubuntu default repository provides an outdated version. Do NOT use nvm — systemd ExecStart requires an absolute path (`/usr/bin/node`) that nvm installs to `~/.nvm` and cannot find.

Install Node.js 20 LTS from the NodeSource apt repository:

```bash
NODE_MAJOR=20
sudo apt-get install -y ca-certificates curl gnupg
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] \
  https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update && sudo apt-get install -y nodejs
```

Verify the installation:

```bash
node --version   # expect v20.x.x
which node       # expect /usr/bin/node
```

## Step 3: Install xcaddy and Build Caddy

> **CRITICAL:** The standard `apt install caddy` binary cannot issue wildcard TLS certificates. The `*.xkedule.com` wildcard requires a DNS-01 ACME challenge, which requires the `caddy-dns/cloudflare` plugin compiled into the binary. This plugin is only available via `xcaddy`.

Install xcaddy:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/xcaddy/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-xcaddy-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/xcaddy/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-xcaddy.list
sudo apt update && sudo apt install xcaddy
```

Build a custom Caddy binary with the Cloudflare DNS module:

```bash
xcaddy build --with github.com/caddy-dns/cloudflare
```

Replace the system Caddy binary (if installed) with the custom build:

```bash
sudo cp caddy /usr/bin/caddy
caddy version   # verify the build succeeded
```

## Step 4: Configure Caddy

Create the Caddy configuration directory and copy the Caddyfile from the repository:

```bash
sudo mkdir -p /etc/caddy
sudo cp /var/www/skleanings/infra/Caddyfile /etc/caddy/Caddyfile
```

Create the Caddy environment file for the Cloudflare API token:

```bash
sudo touch /etc/caddy/caddy.env
sudo chmod 600 /etc/caddy/caddy.env
sudo chown root:root /etc/caddy/caddy.env
```

Add your Cloudflare API token to the file:

```bash
# /etc/caddy/caddy.env
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
```

Edit the Caddy systemd unit to load the environment file. Add `EnvironmentFile=/etc/caddy/caddy.env` under the `[Service]` section:

```bash
sudo systemctl edit caddy
```

Add these lines in the editor:

```ini
[Service]
EnvironmentFile=/etc/caddy/caddy.env
```

Enable and start Caddy:

```bash
sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl start caddy
sudo systemctl status caddy
```

**Cloudflare API Token requirements:**
- Permission scope: Zone > DNS > Edit
- This token is used by Caddy to create TXT records for the DNS-01 ACME challenge

**Adding a custom tenant domain:**
Add a new site block to `/etc/caddy/Caddyfile` and reload:

```caddyfile
cleaning.tenantcustomdomain.com {
    reverse_proxy localhost:5000
}
```

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

Custom tenant domains use Caddy's automatic HTTP-01 certificate issuance — no DNS plugin needed for individual custom domains.

## Step 5: Clone Repository and Configure Environment

Create the application directory and clone the repository as the `skleanings` user:

```bash
sudo mkdir -p /var/www/skleanings
sudo chown skleanings:skleanings /var/www/skleanings

git clone https://github.com/your-org/skleanings.git /var/www/skleanings
cd /var/www/skleanings
npm ci
npm run build
```

Create the environment file for the application:

```bash
sudo mkdir -p /etc/skleanings
sudo touch /etc/skleanings/.env
sudo chmod 600 /etc/skleanings/.env
sudo chown skleanings:skleanings /etc/skleanings/.env
```

Edit `/etc/skleanings/.env` with the required variables. Use bare `KEY=value` format — no `export`, no shell quoting:

```
# /etc/skleanings/.env — loaded by systemd EnvironmentFile
# NO 'export' prefix. NO shell substitutions. Bare KEY=value only.
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/db
SESSION_SECRET=long-random-string-at-least-32-chars
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=$2b$10$...
SUPER_ADMIN_EMAIL=superadmin@xkedule.com
SUPER_ADMIN_PASSWORD_HASH=$2b$10$...
CLOUDFLARE_API_TOKEN=cf_token_here
```

> **WARNING:** Using `export KEY=value` or shell-quoted values causes systemd to fail with "Failed to load environment files". Use bare `KEY=value` only. Comments (`# ...`) are allowed.

To generate bcrypt password hashes:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('yourpassword', 10).then(h => console.log(h));"
```

## Step 6: Install systemd Service

Copy the service unit from the repository and enable it:

```bash
sudo cp /var/www/skleanings/infra/app.service /etc/systemd/system/skleanings.service
sudo systemctl daemon-reload
sudo systemctl enable skleanings
sudo systemctl start skleanings
sudo systemctl status skleanings
```

View application logs in real time:

```bash
journalctl -u skleanings -f
```

## Step 7: Cloudflare DNS Configuration

In the Cloudflare dashboard for `xkedule.com`:

1. Add a wildcard A record:
   - **Name:** `*`
   - **Value:** Hetzner server IP address
   - **Proxy:** Proxied (orange cloud) — enables DDoS protection

2. Add a root A record:
   - **Name:** `@`
   - **Value:** Hetzner server IP address
   - **Proxy:** Proxied (orange cloud)

3. Set SSL/TLS mode to **Full (strict)** — Caddy manages valid Let's Encrypt certificates via DNS-01 challenge.

> **Note:** The DNS-01 ACME challenge creates TXT records (`_acme-challenge.xkedule.com`) and is unaffected by Cloudflare proxy status. Proxied records (orange cloud) do not interfere with certificate issuance.

## Step 8: Configure GitHub Secrets for Deploy Workflow

In the GitHub repository, go to Settings > Secrets and variables > Actions, and add these three secrets:

| Secret | Description |
|--------|-------------|
| `HETZNER_SSH_KEY` | Private Ed25519 SSH key (entire PEM contents including header/footer) |
| `HETZNER_HOST` | IP address or hostname of the Hetzner VM |
| `HETZNER_USER` | Linux username on the server (e.g., `skleanings`) |

Generate an Ed25519 keypair for deployments:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/hetzner_deploy
```

- Copy the **public key** (`~/.ssh/hetzner_deploy.pub`) to the server's `~/.ssh/authorized_keys`
- Copy the **private key** (`~/.ssh/hetzner_deploy`) contents into the `HETZNER_SSH_KEY` GitHub secret

To trigger a deployment: Actions > Deploy to Hetzner > Run workflow (workflow_dispatch only — never runs automatically on push).

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Failed to load environment files` | `export` prefix or quotes in `.env` | Rewrite `/etc/skleanings/.env` with bare `KEY=value` format |
| Caddy `unrecognized module` or `dns provider not found` | Standard apt caddy binary installed | Rebuild with xcaddy (Step 3) and replace `/usr/bin/caddy` |
| Wildcard cert issuance fails | `CLOUDFLARE_API_TOKEN` missing or wrong permissions | Verify token has Zone > DNS > Edit scope in Cloudflare dashboard |
| `systemctl start skleanings` exits immediately | Wrong Node path in ExecStart | Run `which node` — must return `/usr/bin/node`; install via NodeSource (Step 2); check `journalctl -u skleanings` |
| Deploy SSH auth fails | Wrong key or not in `authorized_keys` | Verify the Ed25519 public key is in `~/.ssh/authorized_keys` on the server |
| Build fails `vite: command not found` | `npm ci --production` or `--omit=dev` used | Use plain `npm ci` (no flags) — devDependencies (vite, esbuild) are required for `npm run build` |
