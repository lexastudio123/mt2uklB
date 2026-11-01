'use server';

import { db } from '@/lib/db';
import {
  OrderError,
  addEvent,
  cancelOrder,
  dispatchOrder,
  markDelivered,
  markPacked,
  markPaid,
  refundOrder,
  sendOrderEmail,
} from '@/lib/orders';
import { logActivity } from '@/lib/activity';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { bool, ids, pounds, str } from '@/lib/admin/forms';
import { currentLotCodes } from '@/lib/admin/queries';
import { m2 } from '@/lib/money';
import { emailConfigured } from '@/lib/email/send';

const mailed = () => (emailConfigured() ? 'emailed' : 'email recorded under Emails (sending is not set up yet)');
import { royalMailTrackingUrl } from '@/lib/site';

const path = (id: string) => `/admin/orders/${id}`;

/** Lot codes typed on the order page: inputs named lot_<orderItemId>. */
function lotsFrom(fd: FormData): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  let any = false;
  for (const [k, v] of fd.entries()) {
    if (k.startsWith('lot_') && typeof v === 'string') {
      out[k.slice(4)] = v.trim().toUpperCase().slice(0, 80);
      any = true;
    }
  }
  return any ? out : undefined;
}

export async function markPaidAction(fd: FormData) {
  const a = await requireArea('orders');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const note = str(fd, 'note', 200);
    const o = await db.order.findUniqueOrThrow({ where: { id } });
    const detail = note ? `${o.paymentMethod === 'card' ? 'Card' : 'Bank transfer'}, ${note}` : null;
    const res = await markPaid(id, { adminId: a.id, detail, notify: bool(fd, 'notify') });
    await logActivity(a.id, 'order.mark_paid', 'order', id, `${o.number}${note ? `: ${note}` : ''}`);
    r = { ok: res.changed ? `Payment recorded for ${o.number}.${bool(fd, 'notify') ? ` Confirmation ${mailed()}.` : ''}` : 'This order was already marked as paid.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function packAction(fd: FormData) {
  const a = await requireArea('orders');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const o = await markPacked(id, { adminId: a.id, lots: lotsFrom(fd) });
    await logActivity(a.id, 'order.pack', 'order', id, o.number);
    r = { ok: `${o.number} is packed.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function dispatchAction(fd: FormData) {
  const a = await requireArea('orders');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const lots = lotsFrom(fd);
    const current = await db.order.findUniqueOrThrow({ where: { id }, select: { status: true } });
    if (lots && (current.status === 'paid' || current.status === 'packed')) await markPacked(id, { adminId: a.id, lots });
    const tracking = str(fd, 'tracking', 60);
    const carrier = str(fd, 'carrier', 60) || 'Royal Mail';
    const o = await dispatchOrder(id, { adminId: a.id, trackingNumber: tracking, carrier, notify: bool(fd, 'notify') });
    await logActivity(a.id, 'order.dispatch', 'order', id, `${o.number} via ${carrier}${tracking ? ` ${tracking}` : ''}`);
    r = { ok: `${o.number} dispatched${bool(fd, 'notify') ? `, customer ${mailed()}` : ''}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function updateTrackingAction(fd: FormData) {
  const a = await requireArea('orders');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const number = str(fd, 'tracking', 60).toUpperCase() || null;
    const carrier = str(fd, 'carrier', 60) || 'Royal Mail';
    const url = str(fd, 'trackingUrl', 300) || (number && /royal\s*mail|parcelforce/i.test(carrier) ? royalMailTrackingUrl(number) : null);
    if (url && !/^https:\/\//.test(url)) throw new UserError('The tracking link must start with https://');
    const o = await db.order.update({ where: { id }, data: { trackingNumber: number, trackingCarrier: carrier, trackingUrl: url } });
    await addEvent(id, 'tracking', `Tracking updated: ${carrier}${number ? ` ${number}` : ''}`, a.id);
    await logActivity(a.id, 'order.tracking', 'order', id, `${o.number} ${number ?? ''}`);
    r = { ok: 'Tracking details saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function deliveredAction(fd: FormData) {
  const a = await requireArea('orders');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const o = await markDelivered(id, { adminId: a.id });
    await logActivity(a.id, 'order.delivered', 'order', id, o.number);
    r = { ok: `${o.number} marked as delivered.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function cancelAction(fd: FormData) {
  const a = await requireArea('orders');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const reason = str(fd, 'reason', 300);
    const o = await cancelOrder(id, { adminId: a.id, reason: reason || undefined, restock: bool(fd, 'restock'), notify: bool(fd, 'notify') });
    await logActivity(a.id, 'order.cancel', 'order', id, `${o.number}${reason ? `: ${reason}` : ''}`);
    r = { ok: `${o.number} cancelled.${o.paymentStatus === 'paid' ? ' The payment still needs refunding.' : ''}` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function refundAction(fd: FormData) {
  const a = await requireArea('refunds');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const amount = pounds(fd, 'amount', { min: 1, label: 'Refund amount' });
    const reason = str(fd, 'reason', 300);
    const o = await refundOrder(id, { adminId: a.id, amount, restock: bool(fd, 'restock'), reason: reason || undefined, notify: bool(fd, 'notify') });
    await logActivity(a.id, 'order.refund', 'order', id, `${o.number}: ${m2(amount)}${reason ? `, ${reason}` : ''}`);
    r = { ok: `Refund of ${m2(amount)} recorded for ${o.number}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function noteAction(fd: FormData) {
  const a = await requireArea('orders');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const body = str(fd, 'body', 2000);
    if (!body) throw new UserError('Write a note first.');
    await addEvent(id, 'note', body, a.id);
    await logActivity(a.id, 'order.note', 'order', id, body.slice(0, 120));
    r = { ok: 'Note added.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function resendAction(fd: FormData) {
  const a = await requireArea('orders');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const kind = str(fd, 'kind');
    if (!['confirmed', 'received_bank', 'dispatched'].includes(kind)) throw new UserError('Unknown email.');
    const o = await db.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
    await sendOrderEmail(o, kind as 'confirmed' | 'received_bank' | 'dispatched', { adminId: a.id });
    await logActivity(a.id, 'order.resend_email', 'order', id, `${o.number}: ${kind}`);
    r = { ok: emailConfigured() ? `Email sent again to ${o.email}.` : `Email recorded under Emails (sending is not set up yet).` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

/** Bulk: mark selected paid orders as packed, recording each item's current lot. */
export async function bulkPackAction(fd: FormData) {
  const a = await requireArea('orders');
  const selected = ids(fd, 'ids').slice(0, 200);
  const ret = str(fd, 'return', 500) || '/admin/orders?status=paid';
  let r: { ok?: string; err?: string };
  try {
    if (!selected.length) throw new UserError('Tick at least one order first.');
    const orders = await db.order.findMany({ where: { id: { in: selected } }, include: { items: true } });
    const lots = await currentLotCodes([...new Set(orders.flatMap((o) => o.items.map((i) => i.productId).filter(Boolean) as string[]))]);
    let done = 0;
    let skipped = 0;
    for (const o of orders) {
      if (o.status !== 'paid') {
        skipped++;
        continue;
      }
      const map: Record<string, string> = {};
      for (const it of o.items) if (!it.lotCodes && it.productId && lots.get(it.productId)) map[it.id] = lots.get(it.productId)!;
      await markPacked(o.id, { adminId: a.id, lots: map });
      done++;
    }
    await logActivity(a.id, 'order.bulk_pack', 'order', undefined, `${done} packed, ${skipped} skipped`);
    r = { ok: `${done} ${done === 1 ? 'order' : 'orders'} marked as packed${skipped ? `, ${skipped} skipped (not paid or already packed)` : ''}.` };
  } catch (e) {
    r = { err: e instanceof OrderError ? e.message : errorMessage(e) };
  }
  back(ret.startsWith('/admin/') ? ret : '/admin/orders', r);
}
