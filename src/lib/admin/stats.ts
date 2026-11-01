import 'server-only';
import { db } from '../db';
import { bankTransferAvailable, cardPaymentsAvailable, type SiteSettings } from '../settings';
import { emailConfigured } from '../email/send';
import { siteUrl } from '../site';
import { dayKey } from './format';

const PAID = ['paid', 'partially_refunded', 'refunded'];

export type DayPoint = { key: string; label: string; long: string; revenue: number; orders: number };

/** Revenue (net of refunds, by payment date) for the last `days` UK calendar days, oldest first. */
export async function revenueSeries(days = 30): Promise<DayPoint[]> {
  const today = dayKey(new Date());
  const [y, m, d] = today.split('-').map(Number);
  const keys: { key: string; date: Date }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i, 12));
    keys.push({ key: dt.toISOString().slice(0, 10), date: dt });
  }
  const orders = await db.order.findMany({
    where: { paidAt: { gte: new Date(Date.now() - (days + 1) * 864e5) }, paymentStatus: { in: PAID } },
    select: { paidAt: true, total: true, refundedAmount: true },
  });
  const map = new Map(keys.map((k) => [k.key, { revenue: 0, orders: 0 }]));
  for (const o of orders) {
    if (!o.paidAt) continue;
    const slot = map.get(dayKey(o.paidAt));
    if (!slot) continue;
    slot.revenue += o.total - o.refundedAmount;
    slot.orders += 1;
  }
  return keys.map(({ key, date }) => ({
    key,
    label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    long: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
    revenue: map.get(key)!.revenue,
    orders: map.get(key)!.orders,
  }));
}

export async function dashboardKpis(series: DayPoint[]) {
  const sum = (pts: DayPoint[]) => pts.reduce((s, p) => ({ revenue: s.revenue + p.revenue, orders: s.orders + p.orders }), { revenue: 0, orders: 0 });
  const today = sum(series.slice(-1));
  const week = sum(series.slice(-7));
  const month = sum(series);
  const [awaiting, toPack, packed, openTickets, lowStock, placed30] = await Promise.all([
    db.order.count({ where: { status: 'awaiting_payment' } }),
    db.order.count({ where: { status: 'paid' } }),
    db.order.count({ where: { status: 'packed' } }),
    db.ticket.count({ where: { status: 'open' } }),
    lowStockProducts(),
    db.order.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 864e5) }, status: { not: 'cancelled' } } }),
  ]);
  return {
    today,
    week,
    month,
    aov: month.orders ? Math.round(month.revenue / month.orders) : 0,
    awaiting,
    toPack,
    packed,
    openTickets,
    lowStock,
    placed30,
  };
}

export async function lowStockProducts() {
  const rows = await db.product.findMany({ where: { trackStock: true, active: true }, select: { id: true, name: true, code: true, stock: true, lowStock: true }, orderBy: { stock: 'asc' } });
  return rows.filter((p) => p.stock <= p.lowStock);
}

export type CheckItem = { done: boolean; label: string; detail: string; href: string };

/** What still needs doing before the shop takes real orders. */
export async function launchChecklist(s: SiteSettings): Promise<CheckItem[]> {
  const bank = bankTransferAvailable(s);
  const card = cardPaymentsAvailable(s);
  const sampleLots = await db.lot.count({ where: { isCurrent: true, isSample: true } });
  const ownersWithoutTwoStep = await db.adminUser.count({ where: { role: 'owner', active: true, totpEnabledAt: null } });
  const co = s.company;
  const placeholders = [co.name, co.address, co.number].some((v) => !v || v.includes('['));
  const url = siteUrl();
  return [
    {
      done: bank || card,
      label: 'Take payments',
      detail: bank || card ? `Available: ${[bank && 'bank transfer', card && 'card'].filter(Boolean).join(' and ')}` : 'Checkout is closed until you add bank details or connect card payments.',
      href: '/admin/settings?tab=payments',
    },
    {
      done: emailConfigured(),
      label: 'Send emails',
      detail: emailConfigured() ? 'SMTP is connected.' : 'Emails are recorded in Emails but not sent. Add SMTP settings to the server .env file.',
      href: '/admin/emails',
    },
    { done: !placeholders, label: 'Company details', detail: placeholders ? 'Footer, invoices and legal pages still show placeholders.' : `${co.name}, ${co.number}`, href: '/admin/settings?tab=store' },
    {
      done: !s.supportEmail.endsWith('@example.co.uk'),
      label: 'Support email',
      detail: s.supportEmail.endsWith('@example.co.uk') ? 'Still the example address.' : s.supportEmail,
      href: '/admin/settings?tab=store',
    },
    {
      done: sampleLots === 0,
      label: 'Real lot reports',
      detail: sampleLots ? `${sampleLots} current ${sampleLots === 1 ? 'lot is' : 'lots are'} sample data from the design. Add your real certificates.` : 'All current lots are real.',
      href: '/admin/lots',
    },
    {
      done: ownersWithoutTwoStep === 0,
      label: 'Two-step sign in for owners',
      detail: ownersWithoutTwoStep
        ? `${ownersWithoutTwoStep} owner ${ownersWithoutTwoStep === 1 ? 'account uses' : 'accounts use'} only a password. Turn on two-step sign in under Your account.`
        : 'Every owner signs in with a password and a code from their phone.',
      href: '/admin/account',
    },
    { done: s.legalReviewed, label: 'Legal pages reviewed', detail: s.legalReviewed ? 'Marked as reviewed.' : 'Have a solicitor review terms, privacy and cookies, then tick “reviewed”.', href: '/admin/settings?tab=store' },
    {
      done: url.startsWith('https://') && !/localhost|127\.0\.0\.1/.test(url),
      label: 'Live web address',
      detail: url.startsWith('https://') && !/localhost/.test(url) ? url : `SITE_URL is ${url}. Set it to your https domain in .env.`,
      href: '/admin/settings?tab=store',
    },
    { done: !s.noindex, label: 'Visible to search engines', detail: s.noindex ? 'Hidden while you set up. Turn this off at launch.' : 'Search engines can index the shop.', href: '/admin/settings?tab=store' },
  ];
}
