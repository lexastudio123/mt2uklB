import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addEvent, cancelOrder, markPaid } from '@/lib/orders';
import { syncCommission } from '@/lib/affiliates';
import { describePayment, verifyWebhook } from '@/lib/payments/stripe';
import { m2 } from '@/lib/money';

type Session = { id: string; payment_status: string; payment_intent: string | null; amount_total: number | null; metadata?: Record<string, string>; client_reference_id?: string | null };
type Charge = { payment_intent: string | null; amount_refunded: number; amount: number };

/**
 * Stripe webhook. In the Stripe dashboard add an endpoint for this URL with the events
 * checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
 * checkout.session.expired and charge.refunded, then put the signing secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  if (!verifyWebhook(payload, req.headers.get('stripe-signature'))) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });

  let event: { type: string; data: { object: unknown } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
  }

  const findOrder = async (s: Session) => {
    const id = s.metadata?.order_id;
    if (id) return db.order.findUnique({ where: { id } });
    if (s.client_reference_id) return db.order.findUnique({ where: { number: s.client_reference_id } });
    return null;
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object as Session;
        if (s.payment_status !== 'paid') break;
        const order = await findOrder(s);
        if (!order) break;
        if (s.amount_total != null && s.amount_total !== order.total) {
          await addEvent(order.id, 'payment', `Check this payment: Stripe charged ${m2(s.amount_total)} but the order total is ${m2(order.total)}.`);
        }
        const detail = s.payment_intent ? await describePayment(s.payment_intent) : null;
        await markPaid(order.id, { detail: detail ?? 'Card', paymentIntent: s.payment_intent });
        break;
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object as Session;
        const order = await findOrder(s);
        // Only the latest payment attempt may cancel the order.
        if (order && order.status === 'awaiting_payment' && order.paymentMethod === 'card' && order.paymentRef === s.id) {
          await cancelOrder(order.id, { reason: 'card payment was not completed', notify: false });
        }
        break;
      }
      case 'charge.refunded': {
        const ch = event.data.object as Charge;
        if (!ch.payment_intent) break;
        const order = await db.order.findFirst({ where: { paymentIntent: ch.payment_intent } });
        if (!order || ch.amount_refunded <= order.refundedAmount) break;
        const full = ch.amount_refunded >= order.total;
        await db.order.update({
          where: { id: order.id },
          data: { refundedAmount: ch.amount_refunded, paymentStatus: full ? 'refunded' : 'partially_refunded', ...(full ? { status: 'refunded', refundedAt: new Date() } : {}) },
        });
        await addEvent(order.id, 'refund', `Refund recorded from Stripe: ${m2(ch.amount_refunded - order.refundedAmount)}`);
        await syncCommission(order.id);
        break;
      }
    }
  } catch (e) {
    console.error('[stripe] webhook handling failed', event.type, e);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
