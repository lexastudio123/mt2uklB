import 'server-only';
import type { Order, OrderItem, Prisma } from '@prisma/client';
import { db } from './db';
import { getSettings } from './settings';
import { sendEmail } from './email/send';
import * as T from './email/templates';
import { refundPayment, stripeConfigured } from './payments/stripe';
import { royalMailTrackingUrl } from './site';
import { m2 } from './money';

export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'packed', 'dispatched', 'delivered', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Labels for the team. */
export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid · to pack',
  packed: 'Packed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/** Labels for customers. */
export const CUSTOMER_STATUS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Processing',
  packed: 'Packed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/** Position on the four-step timeline (placed, packed, dispatched, delivered). */
export const timelineStage = (status: string) =>
  ({ awaiting_payment: 0, paid: 1, packed: 2, dispatched: 3, delivered: 4 })[status] ?? 0;

export type OrderFull = Order & { items: OrderItem[] };
type Tx = Prisma.TransactionClient;

export class OrderError extends Error {}

const load = (id: string) => db.order.findUniqueOrThrow({ where: { id }, include: { items: true } });

export async function addEvent(orderId: string, type: string, message: string, adminId?: string | null) {
  await db.orderEvent.create({ data: { orderId, type, message, adminId: adminId ?? null } });
}

// ───────────── Stock ─────────────

/** Vials each product loses for these lines (a bundle draws from its components). */
async function stockNeeds(tx: Tx, items: Pick<OrderItem, 'productId' | 'packQty' | 'qty'>[]) {
  const need = new Map<string, number>();
  for (const it of items) {
    if (!it.productId) continue;
    const p = await tx.product.findUnique({ where: { id: it.productId }, include: { bundleItems: true } });
    if (!p) continue;
    if (p.kind === 'bundle' && p.bundleItems.length) {
      for (const b of p.bundleItems) need.set(b.productId, (need.get(b.productId) ?? 0) + b.qty * it.packQty * it.qty);
    } else need.set(p.id, (need.get(p.id) ?? 0) + it.packQty * it.qty);
  }
  return need;
}

export async function reserveStock(tx: Tx, orderId: string, items: Pick<OrderItem, 'productId' | 'packQty' | 'qty'>[], opts: { force?: boolean; adminId?: string } = {}) {
  for (const [productId, n] of await stockNeeds(tx, items)) {
    const p = await tx.product.findUnique({ where: { id: productId } });
    if (!p || !p.trackStock || n <= 0) continue;
    const r = await tx.product.updateMany({
      where: opts.force ? { id: productId } : { id: productId, stock: { gte: n } },
      data: { stock: { decrement: n } },
    });
    if (r.count !== 1) throw new OrderError(`Sorry, we only have ${p.stock} ${p.stock === 1 ? 'vial' : 'vials'} of ${p.name} left. Please reduce the quantity.`);
    await tx.stockMovement.create({ data: { productId, delta: -n, reason: 'order', orderId, adminId: opts.adminId ?? null } });
  }
}

export async function releaseStock(tx: Tx, orderId: string, items: Pick<OrderItem, 'productId' | 'packQty' | 'qty'>[], reason: string, adminId?: string | null) {
  for (const [productId, n] of await stockNeeds(tx, items)) {
    const p = await tx.product.findUnique({ where: { id: productId } });
    if (!p || !p.trackStock || n <= 0) continue;
    await tx.product.update({ where: { id: productId }, data: { stock: { increment: n } } });
    await tx.stockMovement.create({ data: { productId, delta: n, reason, orderId, adminId: adminId ?? null } });
  }
}

// ───────────── Emails ─────────────

type EmailKind = 'received_bank' | 'confirmed' | 'dispatched' | 'cancelled' | 'refunded';
const EMAIL_LABEL: Record<EmailKind, string> = {
  received_bank: 'Order received (bank details)',
  confirmed: 'Order confirmation',
  dispatched: 'Dispatch',
  cancelled: 'Cancellation',
  refunded: 'Refund',
};

export async function sendOrderEmail(o: OrderFull, kind: EmailKind, extra: { reason?: string; amount?: number; adminId?: string | null } = {}) {
  const s = await getSettings();
  const r =
    kind === 'received_bank' ? T.orderReceivedBank(o, s)
    : kind === 'confirmed' ? T.orderConfirmed(o, s)
    : kind === 'dispatched' ? T.orderDispatched(o, s)
    : kind === 'cancelled' ? T.orderCancelled(o, s, extra.reason)
    : T.orderRefunded(o, s, extra.amount ?? o.refundedAmount);
  const res = await sendEmail({ to: o.email, subject: r.subject, html: r.html, template: `order_${kind}`, orderId: o.id, customerId: o.customerId });
  const how = res.status === 'sent' ? 'sent' : res.status === 'logged' ? 'recorded (email sending is not set up yet)' : 'FAILED to send';
  await addEvent(o.id, 'email', `${EMAIL_LABEL[kind]} email ${how} to ${o.email}`, extra.adminId);
}

export async function notifyTeamNewOrder(o: OrderFull) {
  const s = await getSettings();
  const to = s.notifyEmail || s.supportEmail;
  if (!to || to.endsWith('@example.co.uk')) return;
  const r = T.adminNewOrder(o, s);
  await sendEmail({ to, subject: r.subject, html: r.html, template: 'team_new_order', orderId: o.id });
}

// ───────────── Status changes ─────────────

/** Record a payment. Safe to call twice (webhook and return page can race). */
export async function markPaid(orderId: string, opts: { adminId?: string | null; detail?: string | null; paymentIntent?: string | null; notify?: boolean } = {}) {
  const o = await load(orderId);
  if (o.paymentStatus !== 'unpaid') return { order: o, changed: false };
  const wasCancelled = o.status === 'cancelled';
  const changed = await db.$transaction(async (tx) => {
    const r = await tx.order.updateMany({
      where: { id: o.id, paymentStatus: 'unpaid' },
      data: {
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
        cancelledAt: null,
        paymentDetail: opts.detail ?? o.paymentDetail,
        paymentIntent: opts.paymentIntent ?? o.paymentIntent,
      },
    });
    if (r.count !== 1) return false;
    if (wasCancelled) await reserveStock(tx, o.id, o.items, { force: true, adminId: opts.adminId ?? undefined });
    await tx.orderEvent.create({
      data: {
        orderId: o.id,
        type: 'payment',
        message: `Payment of ${m2(o.total)} received${opts.detail ? ` (${opts.detail})` : ''}${wasCancelled ? '. The order was cancelled and has been reopened; stock was reserved again.' : ''}`,
        adminId: opts.adminId ?? null,
      },
    });
    return true;
  });
  const order = await load(orderId);
  if (changed && opts.notify !== false) {
    await sendOrderEmail(order, 'confirmed', { adminId: opts.adminId });
    if (o.paymentMethod === 'card') await notifyTeamNewOrder(order);
  }
  return { order, changed };
}

export async function markPacked(orderId: string, opts: { adminId?: string | null; lots?: Record<string, string> } = {}) {
  const o = await load(orderId);
  if (o.status !== 'paid' && o.status !== 'packed') throw new OrderError('Only paid orders can be packed.');
  await db.$transaction(async (tx) => {
    for (const it of o.items) {
      const lot = opts.lots?.[it.id]?.trim();
      if (lot !== undefined) await tx.orderItem.update({ where: { id: it.id }, data: { lotCodes: lot || null } });
    }
    if (o.status === 'paid') {
      await tx.order.update({ where: { id: o.id }, data: { status: 'packed', packedAt: new Date() } });
      await tx.orderEvent.create({ data: { orderId: o.id, type: 'status', message: 'Marked as packed', adminId: opts.adminId ?? null } });
    } else if (opts.lots) {
      await tx.orderEvent.create({ data: { orderId: o.id, type: 'note', message: 'Lot numbers updated', adminId: opts.adminId ?? null } });
    }
  });
  return load(orderId);
}

export async function dispatchOrder(
  orderId: string,
  opts: { adminId?: string | null; trackingNumber?: string; carrier?: string; trackingUrl?: string; notify?: boolean } = {},
) {
  const o = await load(orderId);
  if (o.status !== 'paid' && o.status !== 'packed') throw new OrderError('Only paid or packed orders can be dispatched.');
  const s = await getSettings();
  const carrier = opts.carrier?.trim() || 'Royal Mail';
  const number = opts.trackingNumber?.trim().toUpperCase() || null;
  const trackingUrl = opts.trackingUrl?.trim() || (number && /royal\s*mail|parcelforce/i.test(carrier) ? royalMailTrackingUrl(number) : null);
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: o.id },
      data: { status: 'dispatched', dispatchedAt: new Date(), packedAt: o.packedAt ?? new Date(), trackingNumber: number, trackingCarrier: carrier, trackingUrl },
    });
    await tx.orderEvent.create({ data: { orderId: o.id, type: 'tracking', message: `Dispatched with ${carrier}${number ? `, tracking ${number}` : ''}`, adminId: opts.adminId ?? null } });
    // Referral reward lands when the referred order ships.
    if (o.referrerId && s.referral.creditPence > 0) {
      const done = await tx.creditEntry.findFirst({ where: { orderId: o.id, customerId: o.referrerId } });
      if (!done) {
        await tx.creditEntry.create({ data: { customerId: o.referrerId, amount: s.referral.creditPence, reason: `Referral reward, order ${o.number}`, orderId: o.id } });
        await tx.customer.update({ where: { id: o.referrerId }, data: { creditPence: { increment: s.referral.creditPence } } });
        await tx.orderEvent.create({ data: { orderId: o.id, type: 'system', message: `Referral credit of ${m2(s.referral.creditPence)} added to the referrer's account` } });
      }
    }
  });
  const order = await load(orderId);
  if (opts.notify !== false) {
    const c = order.customerId ? await db.customer.findUnique({ where: { id: order.customerId }, select: { shippingUpdates: true } }) : null;
    if (!c || c.shippingUpdates) await sendOrderEmail(order, 'dispatched', { adminId: opts.adminId });
    else await addEvent(order.id, 'email', 'Dispatch email not sent: the customer turned off shipping updates', opts.adminId);
  }
  return order;
}

export async function markDelivered(orderId: string, opts: { adminId?: string | null } = {}) {
  const o = await load(orderId);
  if (o.status !== 'dispatched') throw new OrderError('Only dispatched orders can be marked delivered.');
  await db.order.update({ where: { id: o.id }, data: { status: 'delivered', deliveredAt: new Date() } });
  await addEvent(o.id, 'status', 'Marked as delivered', opts.adminId);
  return load(orderId);
}

/** Cancel an order that has not shipped. Returns stock, discount usage and any store credit used. */
export async function cancelOrder(orderId: string, opts: { adminId?: string | null; reason?: string; notify?: boolean; restock?: boolean } = {}) {
  const o = await load(orderId);
  if (!['awaiting_payment', 'paid', 'packed'].includes(o.status)) throw new OrderError('Dispatched, delivered or refunded orders cannot be cancelled. Issue a refund instead.');
  const r = await db.$transaction(async (tx) => {
    const u = await tx.order.updateMany({ where: { id: o.id, status: o.status }, data: { status: 'cancelled', cancelledAt: new Date() } });
    if (u.count !== 1) return false;
    if (opts.restock !== false) await releaseStock(tx, o.id, o.items, 'cancel', opts.adminId);
    if (o.discountCode) await tx.discountCode.updateMany({ where: { code: o.discountCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    if (o.credit > 0 && o.customerId) {
      await tx.customer.update({ where: { id: o.customerId }, data: { creditPence: { increment: o.credit } } });
      await tx.creditEntry.create({ data: { customerId: o.customerId, amount: o.credit, reason: `Credit returned, order ${o.number} cancelled`, orderId: o.id } });
    }
    const owed = o.paymentStatus === 'paid' ? ` Payment of ${m2(o.total - o.refundedAmount)} still needs refunding.` : '';
    await tx.orderEvent.create({ data: { orderId: o.id, type: 'status', message: `Cancelled${opts.reason ? `: ${opts.reason}` : ''}.${owed}`, adminId: opts.adminId ?? null } });
    return true;
  });
  const order = await load(orderId);
  if (r && opts.notify !== false) await sendOrderEmail(order, 'cancelled', { reason: opts.reason, adminId: opts.adminId });
  return order;
}

/** Refund all or part of a paid order. Card payments are refunded through Stripe automatically. */
export async function refundOrder(orderId: string, opts: { adminId?: string | null; amount: number; restock?: boolean; reason?: string; notify?: boolean }) {
  const o = await load(orderId);
  if (o.paymentStatus !== 'paid' && o.paymentStatus !== 'partially_refunded') throw new OrderError('Only paid orders can be refunded.');
  const remaining = o.total - o.refundedAmount;
  const amount = Math.round(opts.amount);
  if (!(amount > 0) || amount > remaining) throw new OrderError(`Refund must be between £0.01 and ${m2(remaining)}.`);

  let how = 'recorded as refunded manually';
  if (o.paymentMethod === 'card' && o.paymentIntent) {
    if (!stripeConfigured()) throw new OrderError('Card payments are not configured, so this card refund cannot be sent. Refund it in your payment provider and record it again.');
    await refundPayment(o.paymentIntent, amount, opts.reason);
    how = 'refunded to the card via Stripe';
  }
  const full = amount === remaining;
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: o.id },
      data: {
        // Absolute value (not increment) so a Stripe webhook landing first cannot double count.
        refundedAmount: o.refundedAmount + amount,
        paymentStatus: full ? 'refunded' : 'partially_refunded',
        ...(full ? { status: 'refunded', refundedAt: new Date() } : {}),
      },
    });
    // A cancelled order already returned its stock; otherwise restock only when the team says the vials came back sealed.
    if (opts.restock && o.status !== 'cancelled') await releaseStock(tx, o.id, o.items, 'refund', opts.adminId);
    await tx.orderEvent.create({ data: { orderId: o.id, type: 'refund', message: `${m2(amount)} ${how}${opts.reason ? `: ${opts.reason}` : ''}`, adminId: opts.adminId ?? null } });
  });
  const order = await load(orderId);
  if (opts.notify !== false) await sendOrderEmail(order, 'refunded', { amount, adminId: opts.adminId });
  return order;
}

// ───────────── Housekeeping ─────────────

const g = globalThis as unknown as { __expiryRan?: number };

/** Cancel unpaid orders past their window so reserved stock comes back. Throttled unless forced. */
export async function expireStaleOrders(force = false): Promise<number> {
  const now = Date.now();
  if (!force && g.__expiryRan && now - g.__expiryRan < 10 * 60_000) return 0;
  g.__expiryRan = now;
  const s = await getSettings();
  const stale = await db.order.findMany({
    where: {
      status: 'awaiting_payment',
      paymentStatus: 'unpaid',
      OR: [
        { paymentMethod: 'bank_transfer', createdAt: { lt: new Date(now - s.payments.bankTransfer.expiryDays * 864e5) } },
        { paymentMethod: 'card', createdAt: { lt: new Date(now - 2 * 36e5) } },
      ],
    },
    select: { id: true, paymentMethod: true },
  });
  for (const o of stale) {
    try {
      await cancelOrder(o.id, {
        reason: o.paymentMethod === 'card' ? 'card payment was not completed' : `no payment received within ${s.payments.bankTransfer.expiryDays} days`,
        notify: o.paymentMethod === 'bank_transfer',
      });
    } catch (e) {
      console.error('[orders] expiry failed for', o.id, e);
    }
  }
  return stale.length;
}
