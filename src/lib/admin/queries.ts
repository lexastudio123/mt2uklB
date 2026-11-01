import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '../db';

export const PER_PAGE = 50;

export type SP = Record<string, string | string[] | undefined>;
export const sp1 = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
};
export const pageOf = (sp: SP) => Math.max(1, Math.min(10_000, Number(sp1(sp, 'page')) || 1));

/** Build a URL with the current filters, overriding some. */
export function hrefWith(base: string, sp: SP, patch: Record<string, string | number | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'ok' || k === 'err') continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val) u.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '') u.delete(k);
    else u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

function dayStart(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return Number.isNaN(+d) ? null : d;
}

// ───────── Orders ─────────

export const ORDER_TABS: [string, string][] = [
  ['', 'All'],
  ['awaiting_payment', 'Awaiting payment'],
  ['paid', 'To pack'],
  ['packed', 'Packed'],
  ['dispatched', 'Dispatched'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
  ['refunded', 'Refunded'],
];

/** Shared by the orders list and its CSV export. */
export function ordersWhere(sp: SP, opts: { ignoreStatus?: boolean } = {}): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  const status = sp1(sp, 'status');
  if (status && !opts.ignoreStatus) and.push({ status });
  const q = sp1(sp, 'q');
  if (q) {
    const up = q.toUpperCase().replace(/\s+/g, '');
    and.push({
      OR: [
        { number: { contains: up } },
        { email: { contains: q.toLowerCase() } },
        { name: { contains: q } },
        { shipPostcode: { contains: up.length > 3 ? `${up.slice(0, -3)} ${up.slice(-3)}` : up } },
        { shipPostcode: { contains: q.toUpperCase() } },
        { trackingNumber: { contains: up } },
      ],
    });
  }
  const from = dayStart(sp1(sp, 'from'));
  const to = dayStart(sp1(sp, 'to'));
  if (from) and.push({ createdAt: { gte: from } });
  if (to) and.push({ createdAt: { lt: new Date(+to + 864e5) } });
  const pay = sp1(sp, 'pay');
  if (pay) and.push({ paymentMethod: pay });
  return and.length ? { AND: and } : {};
}

// ───────── Customers ─────────

export function customersWhere(sp: SP): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = [];
  const q = sp1(sp, 'q');
  if (q) and.push({ OR: [{ email: { contains: q.toLowerCase() } }, { name: { contains: q } }, { phone: { contains: q } }, { referralCode: { contains: q.toUpperCase() } }] });
  const acct = sp1(sp, 'account');
  if (acct === 'yes') and.push({ passwordHash: { not: null } });
  if (acct === 'no') and.push({ passwordHash: null });
  if (sp1(sp, 'marketing') === 'yes') and.push({ marketingOptIn: true });
  if (sp1(sp, 'blocked') === 'yes') and.push({ blocked: true });
  const tag = sp1(sp, 'tag');
  if (tag) and.push({ tags: { contains: tag.toLowerCase() } });
  return and.length ? { AND: and } : {};
}

/** Orders, net spend and last order date for a set of customers. */
export async function customerTotals(ids: string[]) {
  if (!ids.length) return new Map<string, { orders: number; spent: number; last: Date | null }>();
  const [counts, paid] = await Promise.all([
    db.order.groupBy({ by: ['customerId'], where: { customerId: { in: ids }, status: { not: 'cancelled' } }, _count: { _all: true }, _max: { createdAt: true } }),
    db.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids }, paymentStatus: { in: ['paid', 'partially_refunded', 'refunded'] } },
      _sum: { total: true, refundedAmount: true },
    }),
  ]);
  const map = new Map<string, { orders: number; spent: number; last: Date | null }>();
  for (const c of counts) if (c.customerId) map.set(c.customerId, { orders: c._count._all, spent: 0, last: c._max.createdAt });
  for (const p of paid) {
    if (!p.customerId) continue;
    const m = map.get(p.customerId) ?? { orders: 0, spent: 0, last: null };
    m.spent = (p._sum.total ?? 0) - (p._sum.refundedAmount ?? 0);
    map.set(p.customerId, m);
  }
  return map;
}

/** Normalise a comma list of tags: lower case, unique, trimmed. */
export const normTags = (s: string) =>
  [...new Set(s.split(',').map((t) => t.trim().toLowerCase().replace(/[^a-z0-9 _-]/g, '')).filter(Boolean))].slice(0, 20).join(',');

/** Current lot codes per product id; bundles join their components' lots. */
export async function currentLotCodes(productIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!productIds.length) return out;
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: {
      lots: { where: { isCurrent: true }, take: 1 },
      bundleItems: { include: { product: { include: { lots: { where: { isCurrent: true }, take: 1 } } } } },
    },
  });
  for (const p of products) {
    const codes = p.kind === 'bundle' && p.bundleItems.length ? p.bundleItems.flatMap((b) => b.product.lots.map((l) => l.code)) : p.lots.map((l) => l.code);
    if (codes.length) out.set(p.id, codes.join(' / '));
  }
  return out;
}
