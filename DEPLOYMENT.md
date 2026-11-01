# Putting MT2 Lab online

The shop is one Node.js app with a SQLite database file and an uploads folder. The simplest reliable home is a small Linux server (VPS) with HTTPS from Caddy.

**You need:** a domain, a VPS (1 vCPU, 2 GB RAM and Ubuntu 24.04 is plenty), an email provider that offers SMTP, and optionally a payment provider for cards. Ordinary "web hosting" plans cannot run the shop: it needs a VPS. Check that the host's rules allow a research-chemical shop.

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
   Set at least `SITE_URL=https://yourdomain.co.uk`, `DOMAIN=yourdomain.co.uk`, a long random `CRON_SECRET` (`openssl rand -hex 24`) and an `ENCRYPTION_KEY` (`openssl rand -base64 32`), which encrypts affiliate bank details and the keys you save in the admin. Save a copy of the encryption key in your password manager: without it, a database backup's bank details and saved keys cannot be read.
   Email, Stripe and the other service keys can stay empty here: you add them in the admin after launch (step 6).

4. **Start it:**
   ```bash
   docker compose up -d --build
   ```
   Caddy fetches the HTTPS certificate on first visit. The database and uploads live in the `shopdata` Docker volume.

5. **Create your admin login:**
   ```bash
   docker compose exec app npm run admin:create -- --link you@example.com "Your Name"
   ```
   It prints a one-time link, valid for 24 hours. Open it and choose your password; you are signed straight in. Nobody else, including whoever set up the server, ever knows the password. (Without `--link` the command asks for the password in the terminal instead.)

6. **Set up the shop** at `https://yourdomain/admin`: turn on two-step sign in under Your account, add your email provider's details (and Stripe's, when you are ready) under **Settings › Connections**, then work through the dashboard's launch checklist (see the end of this guide).

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
npm run admin:create -- --link you@example.com "Your Name"

pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup     # follow the printed command so it restarts after a reboot
```

Copy `deploy/Caddyfile.host` to `/etc/caddy/Caddyfile`, replace the domain, then `sudo systemctl reload caddy`.

**Updating later:** `git pull && npm ci && npm run build && npx prisma migrate deploy && pm2 restart mt2lab`

---

## Scheduled jobs

Add these with `crontab -e` on the server.

```cron
# Every hour: cancel unpaid orders past their window (returns the stock), approve affiliate
# commission whose hold period has ended, tidy old sessions
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

1. In **Admin › Settings › Connections** enter the SMTP server, port, username and password from your provider, and a From address such as `MT2 Lab <orders@yourdomain.co.uk>`. Saving signs in to the mail server first and sends you a test email; nothing is saved if the details are wrong. (Or put them in `.env` as `SMTP_*` and `MAIL_FROM`, which take priority.)
2. Add the provider's **SPF** and **DKIM** DNS records for your domain, and a **DMARC** record, so emails are not marked as spam.
3. In Admin › Settings › Store set the support email (shown to customers, used as reply-to) and the notification email (new order and message alerts).
4. Check Admin › Emails: entries should say *sent*.

---

## Card payments (Stripe)

Check first that your processor accepts research chemical merchants.

1. In **Admin › Settings › Connections** paste the secret key (start with a test key, `sk_test_...`). Stripe checks it before it is saved.
2. In the Stripe dashboard › Developers › Webhooks, add an endpoint `https://yourdomain.co.uk/api/webhooks/stripe` with these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
3. Paste the endpoint's signing secret (`whsec_...`) into the second box and save. Turn on card payment under Settings › Payments.
4. Place a test order with card `4242 4242 4242 4242`, any future date and any CVC. The order should switch to *Paid* by itself and the receipt email should go out.
5. Switch to the live key and the live endpoint's signing secret when you are ready.

The keys are stored encrypted, are never shown again, and only owners can change them. Every owner gets an email when they change. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env` take priority if you prefer to keep them there.

Apple Pay and Google Pay appear automatically on Stripe's checkout page.

---

## Optional extras

- **AI chat replies:** add a key from console.anthropic.com under Settings › Connections (or `ANTHROPIC_API_KEY`). `CHAT_MODEL` defaults to Claude Opus 5.5; `claude-haiku-5-5` costs far less per message.
- **UK address lookup:** add an Ideal Postcodes key under Settings › Connections (or `IDEAL_POSTCODES_API_KEY`).

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
- [ ] Support and notification emails set, email connected under Settings › Connections (Admin › Emails says *sent*)
- [ ] Bank details and/or card payments set up, and a real test order placed and refunded
- [ ] Real lot results and certificates uploaded in Admin › Lots, the sample lots unpublished
- [ ] Stock levels checked in Admin › Products
- [ ] Terms, privacy, cookies and the affiliate programme rules reviewed by a solicitor, then "Legal pages reviewed" ticked
- [ ] Affiliate programme settings checked (commission, customer discount, hold period, minimum payout), or the programme switched off in Admin › Settings › Affiliates
- [ ] `ENCRYPTION_KEY` set and a copy stored safely (it also protects the keys saved under Connections)
- [ ] "Hide from search engines" switched off in Admin › Settings when you are ready to be found
- [ ] Hourly cron and nightly backups added, and one backup restored as a test
- [ ] Remove `ADMIN_PASSWORD` from `.env` after the first login
- [ ] Turn on two-step sign in for every owner (Admin › Your account)
