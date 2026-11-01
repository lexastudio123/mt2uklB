'use server';

import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { CUSTOMER_STATUS, timelineStage } from '@/lib/orders';
import { fday } from '@/lib/eta';
import { clientIp, rateLimit } from '@/lib/security';
import { ORDER_NO_RE } from '@/lib/site';

export type TrackState = {
  values?: { order: string; who: string };
  errors?: { order?: string; who?: string };
  notFound?: boolean;
  result?: {
    number: string;
    label: string;
    tone: string;
    stage: number;
    dates: string[];
    note: string;
    trackingUrl?: string | null;
    carrier?: string | null;
    orderUrl?: string;
  };
};

/** Order status lookup without an account: order number plus the email or postcode on the order. */
export async function trackOrder(_prev: TrackState, fd: FormData): Promise<TrackState> {
  const order = String(fd.get('order') || '').trim().toUpperCase().replace(/\s+/g, '');
  const who = String(fd.get('who') || '').trim();
  const values = { order, who };
  const errors: TrackState['errors'] = {};
  if (!ORDER_NO_RE.test(order)) errors.order = 'Order numbers look like MT12345';
  if (!who) errors.who = 'Enter the email or postcode from your order';
  if (errors.order || errors.who) return { values, errors };
  if (!rateLimit(`track:${clientIp(await headers())}`, 15, 15 * 60_000).ok) return { values, errors: { order: 'Too many lookups. Please wait a few minutes.' } };

  const o = await db.order.findUnique({ where: { number: order } });
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, '');
  const match = o && (o.email === who.toLowerCase() || norm(o.shipPostcode) === norm(who));
  if (!o || !match) return { values, notFound: true };

  const stage = ['cancelled', 'refunded'].includes(o.status) ? -1 : timelineStage(o.status);
  const label = o.status === 'awaiting_payment' ? 'Awaiting payment' : o.status === 'paid' ? 'Paid, being packed' : o.status === 'packed' ? 'Packed and waiting for collection' : CUSTOMER_STATUS[o.status] ?? o.status;
  const tone = ['dispatched', 'delivered'].includes(o.status) ? 'good' : ['cancelled', 'refunded'].includes(o.status) ? '' : 'warn';
  const note =
    o.status === 'awaiting_payment'
      ? o.paymentMethod === 'bank_transfer'
        ? `Waiting for your bank transfer with reference ${o.number}.`
        : 'Waiting for card payment.'
      : o.status === 'dispatched'
        ? `Dispatched ${o.dispatchedAt ? fday(o.dispatchedAt) : ''}${o.trackingNumber ? ` with tracking number ${o.trackingNumber}.` : '.'}`
        : o.status === 'delivered'
          ? `Delivered ${o.deliveredAt ? fday(o.deliveredAt) : ''}.`
          : o.status === 'cancelled'
            ? 'This order was cancelled.'
            : o.status === 'refunded'
              ? 'This order was refunded.'
              : `${o.shippingMethodName} delivery${o.etaFrom ? `, expected ${fday(o.etaFrom)}` : ''}.`;
  return {
    values,
    result: {
      number: o.number,
      label,
      tone,
      stage,
      dates: [o.createdAt, o.packedAt, o.dispatchedAt, o.deliveredAt].map((d) => (d ? fday(d) : '')),
      note,
      trackingUrl: o.trackingUrl,
      carrier: o.trackingCarrier,
      // Matching the email proves enough to show the full order; a postcode alone only shows the status.
      orderUrl: o.email === who.toLowerCase() ? `/order/${o.accessToken}` : undefined,
    },
  };
}
