# MT2 Lab

Storefront and admin CRM for MT2 Lab, a UK supplier of Melanotan I and II for laboratory research.
Built from the MT2 Lab design preview: same look, copy and research-use-only safeguards, now running on a real database with real orders.

## What is included

**Shop**
- Home, shop, product pages (pack sizes, savings, sticky add bar, research summary, specification, lot report, delivery), MT1 vs MT2 science page, lot reports with lookup and a permanent page per lot (good for a QR code on the label)
- Basket drawer and basket page with upsells, free-delivery meter, discount codes and live dispatch countdown (UK bank holidays included)
- Three-step checkout: details (optional UK address lookup), delivery method, payment
  - **Bank transfer** works out of the box: the order is reserved, the customer gets bank details and a reference on screen and by email, the team marks it paid
  - **Card, Apple Pay and Google Pay** through Stripe Checkout when keys are added (hosted page: card numbers never touch your server)
  - Store credit and referral codes
- Order confirmation, printable invoice, order tracking without an account
- Customer accounts: sign in, create account, password reset, one-time email sign-in links, orders, reorder, restock alerts, addresses, details, refer a friend
- Help centre, delivery, returns, about, contact form (creates a support conversation), terms, privacy, cookies
- Research-use-only age notice, first-order discount pop-up, newsletter sign-up, chat assistant
- SEO: per-page titles and descriptions, sitemap, robots rules (hidden from search engines until you switch it on), product structured data

**Admin CRM** at `/admin`
- Dashboard with revenue, orders to pack, open messages, low stock and a launch checklist
- Orders: filters, search, CSV export, timeline, mark paid, pack (record lot numbers), dispatch with tracking, deliver, cancel, refund, resend emails, packing slips
- Customers: profiles, notes, tags, order history, store credit, referral, password reset, data export, and anonymise (once their orders have shipped or been cancelled)
- Inbox: contact form conversations with email replies, plus chat transcripts
- Products, pack prices, stock and stock history; lots with certificate upload, "make current" and alert emails
- Discount codes, subscribers, email log, settings (store, delivery, payments, checkout, marketing, referral, chat), team accounts with roles, activity log

**Behind the scenes**
- Every order, payment, email and admin action is recorded
- Stock is reserved when an order is placed and returned when an unpaid order expires or is cancelled
- Emails are branded HTML; without SMTP settings they are recorded in Admin › Emails instead of being sent, so the whole shop can be tested before launch

## Run it on your computer

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env        # then set ADMIN_EMAIL and ADMIN_PASSWORD for your first login
npm run setup               # creates the database and the catalogue
npm run dev
```

Open http://localhost:3000 for the shop and http://localhost:3000/admin for the CRM.
To add or reset an admin login at any time: `npm run admin:create`.

Before you can take a test order, add bank details (any values for testing) in **Admin › Settings › Payments**, or add Stripe test keys to `.env`.

## Configuration

Secrets live in `.env` (see `.env.example`, every line is explained there). Everything else is in **Admin › Settings**, including company details shown on legal pages and invoices, delivery prices, bank details, the discount pop-up and referral rewards.

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Public address, used in emails and payment redirects |
| `DATABASE_URL` | SQLite file by default |
| `UPLOAD_DIR` | Where lot certificates and images are stored |
| `SMTP_*`, `MAIL_FROM` | Sending email (any SMTP provider) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card payments |
| `ANTHROPIC_API_KEY`, `CHAT_MODEL` | AI replies in the chat assistant (optional) |
| `IDEAL_POSTCODES_API_KEY` | UK address lookup at checkout (optional) |
| `CRON_SECRET` | Protects the hourly maintenance endpoint |

## Payments: read this before launch

Many mainstream payment processors do not accept research peptide merchants. Check your provider's acceptable use policy before relying on card payments. Bank transfer works without any provider. The card integration lives in `src/lib/payments/stripe.ts`; another hosted-checkout provider can be added alongside it with the same create-session, webhook and refund steps.

## The chat assistant

Without an API key the assistant answers from built-in replies (prices, packs, delivery, returns, lots, payments, tracking). With `ANTHROPIC_API_KEY` set it uses Claude (Claude Opus 5.5 by default; set `CHAT_MODEL=claude-haiku-5-5` for a much cheaper model) with tools to search the catalogue, add to the basket, look up an order (order number plus email or postcode) and give delivery estimates. Server-side refusal fallbacks are switched on.

Questions about doses, injecting, reconstitution or personal use are declined by a fixed filter before any AI call, and the AI has the same rules in its instructions. Declined conversations are flagged in Admin › Inbox › Chats.

## Editing words on the site

| What | Where |
| --- | --- |
| Product names, descriptions, research summaries, specifications, prices, stock | Admin › Products |
| Lot results and certificates | Admin › Lots |
| Company details, delivery prices, bank details, announcement bar | Admin › Settings |
| Home page sections | `src/app/(shop)/page.tsx` |
| Science page | `src/app/(shop)/science/page.tsx` |
| Help centre, returns and about copy | `src/content/help.ts` |
| Terms, privacy and cookies | `src/content/legal.tsx` (have a solicitor review them, then tick "Legal pages reviewed" in Settings) |
| Email wording | `src/lib/email/templates.ts` |
| Colours and layout | `src/styles/shop.css` (the original design's stylesheet) |

## Project layout

```
prisma/schema.prisma      database tables
prisma/seed.ts            starting catalogue, lots and WELCOME10 code
src/app/(shop)/           storefront pages
src/app/(checkout)/       enclosed checkout
src/app/admin/            admin CRM
src/app/api/              checkout, chat, webhooks, cron, health
src/lib/                  orders, checkout, payments, email, auth, settings
src/components/shop/      storefront components
src/content/              long-form copy
deploy/                   Caddy and PM2 files
scripts/                  create-admin, backup
```

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run setup` | Apply migrations and seed an empty shop |
| `npm run admin:create` | Create an admin or reset a password |
| `npm run typecheck` | TypeScript check |
| `npm run smoke -- https://yourdomain` | Check every public page and the key APIs respond |
| `scripts/backup.sh` | Back up the database and uploads |

## Security notes

- Passwords are hashed with scrypt; sessions are random tokens stored hashed, in HTTP-only cookies
- Admin pages and actions check the signed-in admin and role on every request (owner, admin, staff)
- Rate limits on sign-in, checkout, contact, chat and lookups; cross-site requests are rejected
- Strict security headers and a content security policy in production
- Card details go straight to the payment provider; bank details are only shown to the customer who placed the order
- Customer order pages use long random links; tracking needs the order number plus the email or postcode

See [DEPLOYMENT.md](DEPLOYMENT.md) to put it online.
