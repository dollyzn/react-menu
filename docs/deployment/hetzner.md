# Production on a Hetzner VPS

From an empty server to the first release: the server, the `.env` (every
variable), DNS, the first boot, JJ Pastéis' catalog, releases and backups.
The stack is the Docker Compose one (`docker-compose.yml`): Caddy (HTTPS) →
web + API + worker, Postgres and Redis, all on one machine.

## 1. Before the server

- **A domain** (e.g. `pedidos.jjpasteis.com.br`) whose DNS you can edit.
- **E-mail sending**: a [Resend](https://resend.com) account (free tier is
  enough) with the domain verified (it gives DNS records: SPF/DKIM), or any
  SMTP provider. Without it, password resets, invites, sign-in codes and
  receipts don't go out, and **staff can't sign in** (the sign-in code goes
  by e-mail).
- **Mercado Pago**: production credentials of the store's account (set later
  in the panel, per store).
- Optional: Google OAuth client (staff "Entrar com Google"), Firebase project
  (web push), Grafana Cloud stack (observability).

## 2. The server (Hetzner Cloud)

1. **Create the server** in Hetzner Cloud Console:
   - Location: **Ashburn (US East)** has the lowest latency to Brazil among
     Hetzner's; Europe works too (~200 ms more).
   - Image: **Ubuntu 24.04**.
   - Type: **2 vCPU / 4 GB RAM** at least (shared vCPU line is fine); the
     image builds run on the server.
   - Networking: public IPv4 + IPv6.
   - SSH key: add yours (no root password).
   - **Backups**: enable (daily server snapshots, +20%): the safety net for
     the database volume.
2. **Firewall** (Console → Firewalls → attach to the server): inbound TCP
   22, 80, 443 (and ICMP); nothing else.
3. **DNS**: an `A` record (and `AAAA` for IPv6) from the domain to the
   server's IP. Caddy only gets the certificate once it resolves.
4. **Base setup** (as root over SSH):

   ```bash
   apt update && apt -y upgrade
   apt -y install unattended-upgrades fail2ban git
   dpkg-reconfigure -f noninteractive unattended-upgrades

   # 2 GB swap: the image builds need memory.
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab

   # Docker Engine + compose plugin (official repository).
   curl -fsSL https://get.docker.com | sh

   # The deploy user (GitHub Actions signs in as it).
   adduser --disabled-password --gecos "" deploy
   usermod -aG docker deploy
   mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
   chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh

   # SSH: keys only, no root.
   sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
   systemctl restart ssh
   ```

5. **The code** (as `deploy`):

   ```bash
   git clone https://github.com/dollyzn/react-menu.git ~/react-menu
   cd ~/react-menu
   cp .env.docker.example .env && chmod 600 .env
   ```

## 3. The `.env` (every variable)

`.env` sits next to `docker-compose.yml` on the server and is never
committed. Generate secrets with `openssl rand -base64 32` (passwords:
`openssl rand -hex 24`, no symbols to escape).

### Required

| Variable | What to put |
| --- | --- |
| `SITE_ADDRESS` | The domain alone: `pedidos.jjpasteis.com.br` (Caddy gets HTTPS for it). `:80` only for plain-HTTP tests. |
| `PUBLIC_URL` | `https://` + the domain: `https://pedidos.jjpasteis.com.br`. Baked into the web build: changing it needs a rebuild (a deploy does it). |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443`. |
| `APP_KEY` | `openssl rand -base64 32`. **Never change it**: it encrypts the stores' Mercado Pago credentials and the 2FA secrets; keep a copy outside the server. |
| `ADMIN_USER` | Your e-mail: the first super user (created by `db:seed`). Must be an inbox you read (sign-in codes go there). |
| `ADMIN_PASS` | A strong password for it. Running `db:seed` again resets the admin to this. |
| `POSTGRES_USER` / `POSTGRES_DB` | `menu` / `menu` (keep the defaults). |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24`. Set once: Postgres keeps the first one in its volume. |
| `REDIS_PASSWORD` | `openssl rand -hex 24`. |
| `HEALTH_CHECK_MONITORING_TOKEN` | `openssl rand -hex 24`: monitors call `PUBLIC_URL/health` with header `X-Monitoring-Secret: <token>`. |
| `MAIL_MAILER` | `resend` (with `RESEND_API_KEY`) or `smtp` (with `SMTP_*`). |
| `MAIL_FROM_ADDRESS` | An address on the verified domain, e.g. `pedidos@jjpasteis.com.br`. |
| `MAIL_FROM_NAME` | Fallback sender name, e.g. `JJ Pastéis` (store e-mails use the store's name). |

### E-mail (one of)

| Variable | What to put |
| --- | --- |
| `RESEND_API_KEY` | Resend → API Keys → "Sending access" key (with `MAIL_MAILER=resend`). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USERNAME` / `SMTP_PASSWORD` | The provider's SMTP (with `MAIL_MAILER=smtp`); `SMTP_SECURE=true` for port 465. |

### Optional

| Variable | What it enables |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Entrar com Google" for existing staff. Google Cloud → APIs & Services → Credentials → OAuth client (Web): authorized origin `PUBLIC_URL`, redirect URI `PUBLIC_URL/api/v1/auth/social/google/callback`. |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Web push from the API: Firebase → Project settings → Service accounts → Generate key (the JSON's fields). The private key in double quotes with `\n` for line breaks. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_PROJECT_ID` / `_MESSAGING_SENDER_ID` / `_APP_ID` | Web push in the browser: Firebase → Project settings → General → Web app config. Baked into the web build. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Firebase → Cloud Messaging → Web Push certificates → key pair. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_HEADERS` | Traces, logs and metrics to Grafana Cloud (docs/development/observability.md). Also where the web's CSP reports show up. |
| `OTEL_TRACES_SAMPLE_RATIO` | `1` (all); lower if the free tier fills up. |
| `APP_ENV` | `production` (shown in Grafana). |
| `LOG_LEVEL` | `info` (default). |

Not needed in production: `TRUSTED_ORIGINS` (web and API share one origin),
`PAYMENTS_FAKE_GATEWAY`, `E2E_TEST_HOOKS` (the API refuses to boot with it).
Uploads stay on the server's `uploads` volume (`DRIVE_DISK=fs`).

### A server that already runs other sites

When something else already listens on 80/443 (nginx, Traefik, another
Caddy), React Menu's Caddy serves plain HTTP on an inner port and the
existing proxy handles the domain and its certificate:

```env
SITE_ADDRESS=:80
HTTP_PORT=8080
HTTPS_PORT=8443
PUBLIC_URL=https://pedidos.jjpasteis.com.br
```

The existing proxy forwards the domain to `http://127.0.0.1:8080`, passing
`Host`, `X-Forwarded-For` and `X-Forwarded-Proto`, without buffering (the
panel's live updates are Server-Sent Events) and allowing uploads of 10 MB.
nginx:

```nginx
server {
    server_name pedidos.jjpasteis.com.br;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
    # listen 443 ssl + certificates: as the other sites (certbot --nginx -d ...)
}
```

React Menu's Caddy trusts private addresses for `X-Forwarded-For`, so the
API still sees each visitor's IP (its limits are per IP). Keep port 8080
closed in the firewall: only the proxy on the same machine uses it.

## 4. First boot

```bash
cd ~/react-menu
docker compose up -d --build                  # first build takes a few minutes
docker compose exec api node ace db:seed      # roles, permissions, the admin user
docker compose logs -f api                    # "started HTTP server"; Ctrl+C to leave
```

Then:

1. Open `PUBLIC_URL/app/login`, sign in with `ADMIN_USER` / `ADMIN_PASS` and
   the code e-mailed to you. Set up an authenticator app in Configurações.
2. Create the store (name, slug, e.g. `jj-pasteis`), mark it as the default.
3. Load JJ Pastéis' catalog (menu, groups, stock, profile, photos), once:

   ```bash
   # the photo folder (kept outside git) from your machine:
   scp -r ~/pessoal/menu-app/jj-fotos deploy@<server>:~/jj-fotos
   docker compose cp ~/jj-fotos api:/tmp/jj-fotos
   docker compose exec api node ace jj:setup --store=jj-pasteis --photos=/tmp/jj-fotos
   ```

4. In the panel, on the store: the real phone (WhatsApp), opening hours,
   pickup time; **Pagamentos**: Mercado Pago production credentials, and copy
   the "URL de notificação (webhook)" into Mercado Pago → Your integrations →
   Webhooks (events: Payments and Order).
5. **Equipe**: invite the staff (each sets a password from the e-mail).
6. Test a real order end to end (Pix of R$ 1, then refund it in the panel).

## 5. Releases (deploy)

`.github/workflows/deploy.yml` deploys on every **published GitHub
release** (or by hand: Actions → Deploy → Run workflow, with a tag). It
backs up the database (last 10 dumps in `~/react-menu/backups`), checks out
the tag, rebuilds and restarts, and waits for the API.

GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | The server's IP (or domain). |
| `VPS_PORT` | `22`. |
| `VPS_USER` | `deploy`. |
| `VPS_KEY` | A private key made for this (`ssh-keygen -t ed25519 -f deploy_key -N ""`), whose `.pub` goes in `/home/deploy/.ssh/authorized_keys`. |
| `VPS_PATH` | `/home/deploy/react-menu`. |

To release: GitHub → Releases → Draft a new release → tag `v1.0.0` on
`main` → Publish. The tag becomes the version shown in Grafana
(`APP_VERSION`).

**Rollback**: run the Deploy workflow by hand with the previous tag. If the
release ran a migration that has to be undone, restore the dump it saved:
`gunzip -c backups/<file>.sql.gz | docker compose exec -T postgres psql -U menu menu`
(on a stopped API: `docker compose stop api worker` first).

## 6. Backups and monitoring

- **Database**: every deploy dumps it; Hetzner Backups snapshot the whole
  server daily. For an off-server copy, a daily cron sending
  `pg_dump | gzip` to a Hetzner Storage Box (or any S3) is cheap insurance.
- **Uploads** (photos, logos) live in the `uploads` Docker volume: covered
  by the server snapshots.
- **`APP_KEY` and `.env`**: keep a copy in a password manager; without
  `APP_KEY` the stored Mercado Pago credentials and 2FA secrets are lost.
- **Uptime**: any monitor (UptimeRobot, Better Stack, Grafana synthetic
  checks) on `PUBLIC_URL/health` with the `X-Monitoring-Secret` header.

## 7. After the first days

- Watch the CSP reports (`csp-report` lines in the web logs, or in Loki):
  when nothing unexpected shows up, enforce the policy (roadmap).
- Once every subdomain is on HTTPS, add `includeSubDomains` to HSTS
  (`docker/caddy/Caddyfile`).
