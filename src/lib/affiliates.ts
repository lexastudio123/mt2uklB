import 'server-only';
import { Prisma, type Affiliate } from '@prisma/client';
import { db } from './db';
import { getSettings, type SiteSettings } from './settings';
import { seal, unseal } from './crypto';
import { sendEmail } from './email/send';
import * as T from './email/templates';
import { randomCode, randomDigits } from './security';
import { m2 } from './money';

// Affiliate programme: partners share a code (or a link that shows the code), customers get a
// discount, and the partner earns a percentage of the order value after discounts, excluding
// delivery. Commission is credited when the order is paid, follows refunds and cancellations,
// and becomes ready to pay once the hold period after dispatch has passed.

export const AFFILIATE_STATUSES = ['pending', 'active', 'paused', 'rejected'] as const;
export type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number];
export const AFFILIATE_STATUS_LABEL: Record<string, string> = { pending: 'Application', active: 'Active', paused: 'Paused', rejected: 'Rejected' };
export const COMMISSION_LABEL: Record<string, string> = { pending: 'Pending', approved: 'Ready to pay', paid: 'Paid', void: 'Void' };

export class AffiliateError extends Error {}

export const CODE_RE = /^[A-Z0-9]{3,20}$/;
export const normaliseCode = (raw: string) => raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

/** 1250 basis points → "12.5%" */
export const pct = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;
/** 12.5 → 1250 */
export const toBps = (percent: number) => Math.round(percent * 100);

/** Affiliates only see the end of an order number: "MT48213" → "213". */
export const orderTail = (n: string) => n.slice(-3);

/** Why a code cannot be given to an affiliate, or null when it is free. */
export async function codeProblem(code: string, exceptId?: string): Promise<string | null> {
  if (!CODE_RE.test(code)) return 'Codes are 3 to 20 letters or numbers, with no spaces.';
  const [a, d] = await Promise.all([
    db.affiliate.findUnique({ where: { code }, select: { id: true } }),
    db.discountCode.findUnique({ where: { code }, select: { id: true } }),
  ]);
  if (a && a.id !== exceptId) return 'Another affiliate already has that code.';
  if (d) return 'A discount code with that name already exists.';
  return null;
}

/** A free code based on the affiliate's first name (or the code they asked for), e.g. SARAH10. */
export async function suggestCode(name: string, wanted?: string | null): Promise<string> {
  const stem = (name.trim().split(/\s+/)[0] || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12);
  const tries = [wanted ? normaliseCode(wanted) : '', stem.length >= 3 ? stem : '', stem ? `${stem}10` : '', ...Array.from({ length: 6 }, () => `${stem || 'LAB'}${randomDigits(2)}`)];
  for (const c of tries) if (c && !(await codeProblem(c))) return c;
  return `LAB${randomCode(6)}`;
}

/** An affiliate whose code works at checkout right now, or null. */
export async function activeAffiliateByCode(code: string, s?: SiteSettings): Promise<Affiliate | null> {
  const settings = s ?? (await getSettings());
  if (!settings.affiliates.enabled || !CODE_RE.test(code)) return null;
  const a = await db.affiliate.findUnique({ where: { code } });
  return a?.status === 'active' ? a : null;
}

// ───────────── Bank details ─────────────

export type BankDetails = { accountName: string; sortCode: string; accountNumber: string; iban: string; bic: string };
type BankFields = Pick<Affiliate, 'bankAccountName' | 'bankSortCode' | 'bankAccountNumber' | 'bankIban' | 'bankBic'>;

/** Decrypted bank details. `unreadable` means they were encrypted with a key this server does not have. */
export function readBank(a: BankFields) {
  const raw = [a.bankAccountName, a.bankSortCode, a.bankAccountNumber, a.bankIban, a.bankBic].map(unseal);
  const [accountName, sortCode, accountNumber, iban, bic] = raw.map((v) => v ?? '');
  return {
    accountName,
    sortCode,
    accountNumber,
    iban,
    bic,
    unreadable: raw.some((v) => v === undefined),
    complete: !!(accountName && ((sortCode && accountNumber) || iban)),
  };
}

export const sealBank = (b: BankDetails) => ({
  bankAccountName: seal(b.accountName),
  bankSortCode: seal(b.sortCode),
  bankAccountNumber: seal(b.accountNumber),
  bankIban: seal(b.iban),
  bankBic: seal(b.bic),
});

/** "12345678" → "•••• 5678" */
export const maskTail = (v: string, keep = 4) => (v ? `•••• ${v.replace(/\s/g, '').slice(-keep)}` : '');

function validIban(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  let rem = 0;
  for (const ch of iban.slice(4) + iban.slice(0, 4)) {
    for (const d of ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

/** Check and tidy bank details typed into a form. All fields empty clears them. */
export function cleanBank(input: BankDetails): { ok: true; bank: BankDetails } | { ok: false; error: string; field: keyof BankDetails } {
  const accountName = input.accountName.trim().replace(/\s+/g, ' ').slice(0, 120);
  const sortCode = input.sortCode.replace(/[\s-]/g, '');
  const accountNumber = input.accountNumber.replace(/[\s-]/g, '');
  const iban = input.iban.replace(/\s/g, '').toUpperCase();
  const bic = input.bic.replace(/\s/g, '').toUpperCase();
  if (!accountName && !sortCode && !accountNumber && !iban && !bic) return { ok: true, bank: { accountName, sortCode, accountNumber, iban, bic } };
  if (!accountName) return { ok: false, error: 'Enter the name on the account', field: 'accountName' };
  if (sortCode || accountNumber) {
    if (!/^\d{6}$/.test(sortCode)) return { ok: false, error: 'A sort code is 6 digits, like 12-34-56', field: 'sortCode' };
    if (!/^\d{6,10}$/.test(accountNumber)) return { ok: false, error: 'A UK account number is usually 8 digits', field: 'accountNumber' };
  }
  if (iban && !validIban(iban)) return { ok: false, error: 'That IBAN does not look right. Check it and try again.', field: 'iban' };
  if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) return { ok: false, error: 'A BIC (SWIFT code) is 8 or 11 letters and numbers', field: 'bic' };
  if (!(sortCode && accountNumber) && !iban) return { ok: false, error: 'Enter a UK sort code and account number, or an IBAN', field: 'sortCode' };
  return {
    ok: true,
    bank: { accountName, sortCode: sortCode ? `${sortCode.slice(0, 2)}-${sortCode.slice(2, 4)}-${sortCode.slice(4)}` : '', accountNumber, iban, bic },
  };
}

// ───────────── Commission ─────────────

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

async function orderNote(orderId: string, message: string) {
  await db.orderEvent.create({ data: { orderId, type: 'system', message } });
}

/**
 * Bring the commission for one order in line with the order: credit it once the order is paid,
 * follow refunds, void it when the order is cancelled or fully refunded, and approve it once the
 * hold period after dispatch has passed. Safe to call any number of times, from anywhere.
 */
export async function syncCommission(orderId: string, opts: { notify?: boolean } = {}): Promise<void> {
  const o = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, affiliateId: true, status: true, paymentStatus: true, subtotal: true, discount: true, refundedAmount: true, dispatchedAt: true },
  });
  if (!o?.affiliateId || o.paymentStatus === 'unpaid') return;
  const affiliate = await db.affiliate.findUnique({ where: { id: o.affiliateId } });
  if (!affiliate) return;
  const s = await getSettings();
  const rows = await db.affiliateCommission.findMany({ where: { orderId: o.id } });
  const sale = rows.find((r) => r.kind === 'sale');

  const basis = o.status === 'cancelled' ? 0 : Math.max(0, o.subtotal - o.discount - o.refundedAmount);
  const rate = sale?.rateBps ?? affiliate.commissionBps;
  const target = Math.round((basis * rate) / 10000);
  const why = o.status === 'cancelled' ? 'Order cancelled' : 'Order refunded';
  const due =
    !!o.dispatchedAt && (o.status === 'dispatched' || o.status === 'delivered') && o.dispatchedAt.getTime() + s.affiliates.holdDays * 864e5 <= Date.now();

  if (!sale) {
    if (target <= 0) return;
    try {
      await db.affiliateCommission.create({
        data: {
          key: `sale:${o.id}`,
          affiliateId: affiliate.id,
          kind: 'sale',
          orderId: o.id,
          rateBps: rate,
          basis,
          amount: target,
          status: due ? 'approved' : 'pending',
          approvedAt: due ? new Date() : null,
        },
      });
    } catch (e) {
      if (isUnique(e)) return; // a parallel call got there first
      throw e;
    }
    await orderNote(o.id, `Affiliate commission of ${m2(target)} (${pct(rate)}) credited to ${affiliate.name}, code ${affiliate.code}`);
    if (opts.notify !== false && affiliate.notifySales && affiliate.status === 'active') {
      await sendAffiliateEmail(affiliate, T.affiliateSale(s, affiliate, { amount: target, basis, orderTail: orderTail(o.number) }), 'affiliate_sale');
    }
    return;
  }

  if (sale.status === 'paid') {
    // Already paid out: keep the order value current for reporting, and anything the
    // affiliate now owes back comes off their next payout.
    if (sale.basis !== basis) await db.affiliateCommission.update({ where: { id: sale.id }, data: { basis } });
    const credited = rows.filter((r) => r.status !== 'void').reduce((n, r) => n + r.amount, 0);
    const owed = target - credited;
    if (owed >= 0) return;
    try {
      await db.affiliateCommission.create({
        data: {
          key: `clawback:${o.id}:${target}`,
          affiliateId: affiliate.id,
          kind: 'clawback',
          orderId: o.id,
          rateBps: rate,
          basis,
          amount: owed,
          status: 'approved',
          approvedAt: new Date(),
          description: `${why} after the commission was paid`,
        },
      });
      await orderNote(o.id, `${m2(-owed)} of commission already paid to ${affiliate.name} will come off their next payout (${why.toLowerCase()})`);
    } catch (e) {
      if (!isUnique(e)) throw e;
    }
    return;
  }

  // The sale has not been paid out, so any clawback from an undone payout no longer applies.
  if (rows.some((r) => r.kind === 'clawback' && (r.status === 'pending' || r.status === 'approved'))) {
    await db.affiliateCommission.updateMany({
      where: { orderId: o.id, kind: 'clawback', status: { in: ['pending', 'approved'] } },
      data: { status: 'void', voidReason: 'The sale is no longer paid out' },
    });
  }

  if (sale.status === 'void') {
    // A row voided by the team (adminId set) stays void. One the system voided comes back
    // if the order does, e.g. a late payment on a cancelled order.
    if (sale.adminId || target <= 0) return;
    await db.affiliateCommission.update({
      where: { id: sale.id },
      data: { status: due ? 'approved' : 'pending', approvedAt: due ? new Date() : null, voidReason: null, basis, amount: target },
    });
    await orderNote(o.id, `Affiliate commission of ${m2(target)} for ${affiliate.name} restored`);
    return;
  }

  if (target <= 0) {
    await db.affiliateCommission.update({ where: { id: sale.id }, data: { status: 'void', voidReason: why, adminId: null } });
    await orderNote(o.id, `Affiliate commission of ${m2(sale.amount)} for ${affiliate.name} cancelled: ${why.toLowerCase()}`);
    return;
  }

  const data: Prisma.AffiliateCommissionUpdateInput = {};
  if (sale.amount !== target || sale.basis !== basis) Object.assign(data, { amount: target, basis });
  if (sale.status === 'pending' && due) Object.assign(data, { status: 'approved', approvedAt: new Date() });
  if (Object.keys(data).length) await db.affiliateCommission.update({ where: { id: sale.id }, data });
  if (sale.amount !== target) await orderNote(o.id, `Affiliate commission for ${affiliate.name} changed from ${m2(sale.amount)} to ${m2(target)} after a refund`);
}

const g = globalThis as unknown as { __affApproved?: number };

/** Approve commission whose hold period has ended. Throttled unless forced (the hourly cron forces it). */
export async function approveDueCommissions(force = false): Promise<number> {
  const now = Date.now();
  if (!force && g.__affApproved && now - g.__affApproved < 10 * 60_000) return 0;
  g.__affApproved = now;
  const s = await getSettings();
  const due = await db.affiliateCommission.findMany({
    where: {
      kind: 'sale',
      status: 'pending',
      order: { status: { in: ['dispatched', 'delivered'] }, dispatchedAt: { lte: new Date(now - s.affiliates.holdDays * 864e5) } },
    },
    select: { orderId: true },
  });
  for (const c of due) if (c.orderId) await syncCommission(c.orderId, { notify: false });
  return due.length;
}

/** When a pending sale clears, for affiliates: the dispatch date plus the hold period. */
export function clearsOn(dispatchedAt: Date | null | undefined, s: SiteSettings): Date | null {
  return dispatchedAt ? new Date(dispatchedAt.getTime() + s.affiliates.holdDays * 864e5) : null;
}

// ───────────── Balances and payouts ─────────────

export type Balance = { pending: number; approved: number; paid: number; sales: number; salesValue: number; lastSaleAt: Date | null };
export const EMPTY_BALANCE: Balance = { pending: 0, approved: 0, paid: 0, sales: 0, salesValue: 0, lastSaleAt: null };

/** Money owed and earned per affiliate. `approved` is what the next payout would be. */
export async function balances(affiliateIds?: string[]): Promise<Map<string, Balance>> {
  const where = affiliateIds ? { affiliateId: { in: affiliateIds } } : {};
  const [open, sales, payouts] = await Promise.all([
    db.affiliateCommission.groupBy({ by: ['affiliateId', 'status'], where: { ...where, status: { in: ['pending', 'approved'] } }, _sum: { amount: true } }),
    db.affiliateCommission.groupBy({
      by: ['affiliateId'],
      where: { ...where, kind: 'sale', status: { not: 'void' } },
      _count: { _all: true },
      _sum: { basis: true },
      _max: { createdAt: true },
    }),
    db.affiliatePayout.groupBy({ by: ['affiliateId'], where, _sum: { amount: true } }),
  ]);
  const out = new Map<string, Balance>();
  const get = (id: string) => {
    let b = out.get(id);
    if (!b) out.set(id, (b = { ...EMPTY_BALANCE }));
    return b;
  };
  for (const r of open) get(r.affiliateId)[r.status as 'pending' | 'approved'] = r._sum.amount ?? 0;
  for (const r of sales) Object.assign(get(r.affiliateId), { sales: r._count._all, salesValue: r._sum.basis ?? 0, lastSaleAt: r._max.createdAt });
  for (const r of payouts) get(r.affiliateId).paid = r._sum.amount ?? 0;
  return out;
}

export async function balanceOf(affiliateId: string): Promise<Balance> {
  return (await balances([affiliateId])).get(affiliateId) ?? { ...EMPTY_BALANCE };
}

/** Pay everything that is ready to pay for one affiliate. */
export async function createPayout(
  affiliateId: string,
  opts: { adminId: string; reference?: string | null; note?: string | null; paidAt?: Date; notify?: boolean },
) {
  const payout = await db.$transaction(async (tx) => {
    const rows = await tx.affiliateCommission.findMany({ where: { affiliateId, status: 'approved', payoutId: null }, select: { id: true, amount: true } });
    const amount = rows.reduce((n, r) => n + r.amount, 0);
    if (!rows.length || amount <= 0) throw new AffiliateError('There is nothing ready to pay for this affiliate.');
    const p = await tx.affiliatePayout.create({
      data: { affiliateId, amount, reference: opts.reference || null, note: opts.note || null, paidAt: opts.paidAt ?? new Date(), adminId: opts.adminId },
    });
    const u = await tx.affiliateCommission.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, status: 'approved', payoutId: null },
      data: { status: 'paid', paidAt: p.paidAt, payoutId: p.id },
    });
    if (u.count !== rows.length) throw new AffiliateError('The commission changed while saving. Please try again.');
    return p;
  });
  if (opts.notify !== false) {
    const [a, s] = await Promise.all([db.affiliate.findUniqueOrThrow({ where: { id: affiliateId } }), getSettings()]);
    await sendAffiliateEmail(a, T.affiliatePayout(s, a, payout), 'affiliate_payout');
  }
  return payout;
}

/** Undo a payout recorded by mistake: its commission goes back to ready to pay. */
export async function undoPayout(payoutId: string) {
  return db.$transaction(async (tx) => {
    const p = await tx.affiliatePayout.findUnique({ where: { id: payoutId } });
    if (!p) throw new AffiliateError('That payout no longer exists.');
    await tx.affiliateCommission.updateMany({ where: { payoutId }, data: { status: 'approved', paidAt: null, payoutId: null } });
    await tx.affiliatePayout.delete({ where: { id: payoutId } });
    return p;
  });
}

// ───────────── Emails ─────────────

export async function sendAffiliateEmail(a: Pick<Affiliate, 'email'>, r: T.Rendered, template: string) {
  return sendEmail({ to: a.email, subject: r.subject, html: r.html, template });
}

export async function notifyTeam(r: T.Rendered, template: string) {
  const s = await getSettings();
  const to = s.notifyEmail || s.supportEmail;
  if (!to || to.endsWith('@example.co.uk')) return;
  await sendEmail({ to, subject: r.subject, html: r.html, template });
}

// ───────────── Reporting ─────────────

const monthKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).slice(0, 7);

/** Clicks, sales and commission per month, newest first. */
export async function monthlyStats(affiliateId: string, months = 6) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1) - 864e5);
  const [clicks, sales] = await Promise.all([
    db.affiliateClick.findMany({ where: { affiliateId, createdAt: { gte: from } }, select: { createdAt: true } }),
    db.affiliateCommission.findMany({ where: { affiliateId, kind: 'sale', status: { not: 'void' }, createdAt: { gte: from } }, select: { createdAt: true, amount: true, basis: true } }),
  ]);
  const rows = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    return { key: monthKey(d), label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), clicks: 0, orders: 0, sales: 0, commission: 0 };
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const c of clicks) {
    const r = byKey.get(monthKey(c.createdAt));
    if (r) r.clicks++;
  }
  for (const c of sales) {
    const r = byKey.get(monthKey(c.createdAt));
    if (r) {
      r.orders++;
      r.sales += c.basis;
      r.commission += c.amount;
    }
  }
  return rows;
}
