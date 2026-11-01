# Putting MT2 Lab online

The shop is one Node.js app with a SQLite database file and an uploads folder. The simplest reliable home is a small Linux server (VPS) with HTTPS from Caddy.

**You need:** a domain, a VPS (1 vCPU, 1 to 2 GB RAM, Ubuntu 24.04 is plenty), an SMTP email provider, and optionally a payment provider for cards.

---

## Option A: Docker on a VPS (recommended)

1. **Point the domain at the server.** At your domain registrar create an `A` record for `@` (and `www`) with the server's IP address.

2. **Install Docker** on the server:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

3. **Get the code and configure it:**
   ```bash
   git clone https://github.com/lexastudio123/mt2uklB.git /opt/mt2lab
   cd /opt/mt2lab
   cp .env.example .env
   nano .env
   ```
   Set at least `SITE_URL=https://yourdomain.co.uk`, `DOMAIN=yourdomain.co.uk`, the `SMTP_*` lines, `MAIL_FROM` and a long random `CRON_SECRET` (`openssl rand -hex 24`).

4. **Start it:**
   ```bash
   docker compose up -d --build
   ```
   Caddy fetches the HTTPS certificate on first visit. The database and uploads live in the `shopdata` Docker volume.

5. **Create your admin login:**
   ```bash
   docker compose exec app npm run admin:create
   ```

6. **Set up the shop** at `https://yourdomain/admin` and work through the dashboard's launch checklist (see the end of this guide).

7. **Check it** from your own computer: `npm run smoke -- https://yourdomain.co.uk` (every public page and key API should show a tick).

**Updating later:**
```bash
cd /opt/mt2lab && git pull && docker compose up -d --build
```
Database migrations run automatically on start.

---

## Option B: Node.js and PM2 on a VPS (no Docker)

```bash
# Node.js 24, Caddy, PM2
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3 caddy
sudo npm install -g pm2

git clone https://github.com/lexastudio123/mt2uklB.git /opt/mt2lab
cd /opt/mt2lab
cp .env.example .env && nano .env
#   SITE_URL=https://yourdomain.co.uk
#   DATABASE_URL="file:/opt/mt2lab/data/mt2lab.db"
#   UPLOAD_DIR=/opt/mt2lab/data/uploads
mkdir -p data/uploads

npm ci
npm run build
npm run setup
npm run admin:create

pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup     # follow the printed command so it restarts after a reboot
```

Copy `deploy/Caddyfile.host` to `/etc/caddy/Caddyfile`, replace the domain, then `sudo systemctl reload caddy`.

**Updating later:** `git pull && npm ci && npm run build && npx prisma migrate deploy && pm2 restart mt2lab`

---

## Scheduled jobs

Add these with `crontab -e` on the server.

```cron
# Every hour: cancel unpaid orders past their window (returns the stock), tidy old sessions
0 * * * * curl -fsS "https://yourdomain.co.uk/api/cron?key=YOUR_CRON_SECRET" > /dev/null

# Every night at 03:15: back up the database and uploads (Docker)
15 3 * * * cd /opt/mt2lab && docker compose exec -T app sh scripts/backup.sh /data /data/backups
# ...or without Docker
15 3 * * * /opt/mt2lab/scripts/backup.sh /opt/mt2lab/data /opt/mt2lab/backups
```

Copy backups off the server regularly (for example with `rclone` to cloud storage). A backup on the same server does not protect against losing the server.

---

## Email

Use any SMTP provider (Postmark, Brevo, Mailgun, Amazon SES, Microsoft 365 or Google Workspace).

1. Put the SMTP host, port, username and password in `.env`, and set `MAIL_FROM`, for example `MT2 Lab <orders@yourdomain.co.uk>`.
2. Add the provider's **SPF** and **DKIM** DNS records for your domain, and a **DMARC** record, so emails are not marked as spam.
3. In Admin › Settings set the support email (shown to customers, used as reply-to) and the notification email (new order and message alerts).
4. Check Admin › Emails: entries should say *sent*.

---

## Card payments (Stripe)

Check first that your processor accepts research chemical merchants.

1. Put the secret key in `STRIPE_SECRET_KEY` (start with a test key, `sk_test_...`).
2. In the Stripe dashboard › Developers › Webhooks, add an endpoint `https://yourdomain.co.uk/api/webhooks/stripe` with these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
3. Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` and restart.
4. Place a test order with card `4242 4242 4242 4242`, any future date and any CVC. The order should switch to *Paid* by itself and the receipt email should go out.
5. Switch to the live key when you are ready.

Apple Pay and Google Pay appear automatically on Stripe's checkout page.

---

## Optional extras

- **AI chat replies:** set `ANTHROPIC_API_KEY` (from console.anthropic.com). `CHAT_MODEL` defaults to Claude Opus 5.5; `claude-haiku-5-5` costs far less per message.
- **UK address lookup:** set `IDEAL_POSTCODES_API_KEY`.

---

## Other hosting

- **Railway, Render, Fly.io:** deploy the Dockerfile, attach a persistent volume at `/data`, set the variables from `.env.example`, and use their cron feature for `/api/cron`.
- **Shared hosting with "Node.js app" support (cPanel):** possible with Option B's commands if the host allows a persistent Node process and SSH; ask the host first.
- **Vercel and other serverless hosts:** not recommended as is. They have no persistent disk, so the database would need moving to PostgreSQL (change `provider` in `prisma/schema.prisma` and run `npx prisma migrate dev --name init` against the new database) and uploads to object storage.

---

## Launch checklist

The admin dashboard shows most of these as it goes.

- [ ] Company name, registered address and company number in Admin › Settings
- [ ] VAT number (only if VAT registered: prices then show "including VAT" and invoices show the VAT amount)
- [ ] Support and notification emails, SMTP working (Admin › Emails says *sent*)
- [ ] Bank details and/or card payments set up, and a real test order placed and refunded
- [ ] Real lot results and certificates uploaded in Admin › Lots, the sample lots unpublished
- [ ] Stock levels checked in Admin › Products
- [ ] Terms, privacy and cookies reviewed by a solicitor, then "Legal pages reviewed" ticked
- [ ] "Hide from search engines" switched off in Admin › Settings when you are ready to be found
- [ ] Hourly cron and nightly backups added, and one backup restored as a test
- [ ] Remove `ADMIN_PASSWORD` from `.env` after the first login
- [ ] Turn on two-step sign in for every owner (Admin › Your account)
