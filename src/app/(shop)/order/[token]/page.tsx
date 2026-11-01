import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCustomer } from '@/lib/auth';
import { bankTransferAvailable, cardPaymentsAvailable, getSettings } from '@/lib/settings';
import { describePayment, retrieveSession, stripeConfigured } from '@/lib/payments/stripe';
import { markPaid, timelineStage, CUSTOMER_STATUS } from '@/lib/orders';
import { m2, money } from '@/lib/money';
import { dispatchDay, fday } from '@/lib/eta';
import { IconTick } from '@/components/icons';
import { CopyButton } from '@/components/shop/bits';
import { Popular } from '@/components/shop/basket-view';
import { Timeline } from '@/components/shop/timeline';
import { SaveAccountForm, AutoRefresh } from './client';

export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string; session_id?: string; cancelled?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;
  let order = await db.order.findUnique({ where: { accessToken: token }, include: { items: true, customer: true } });
  if (!order) notFound();

  // Back from the card payment page: confirm with Stripe straight away in case the webhook is still on its way.
  if (sp.paid && sp.session_id && order.paymentMethod === 'card' && order.paymentStatus === 'unpaid' && stripeConfigured()) {
    try {
      const session = await retrieveSession(sp.session_id);
      if (session.metadata?.order_id === order.id && session.payment_status === 'paid') {
        const detail = session.payment_intent ? await describePayment(session.payment_intent) : null;
        await markPaid(order.id, { detail: detail ?? 'Card', paymentIntent: session.payment_intent });
        order = (await db.order.findUnique({ where: { id: order.id }, include: { items: true, customer: true } }))!;
      }
    } catch (e) {
      console.error('[order] could not confirm session', e);
    }
  }

  const [s, me] = await Promise.all([getSettings(), getCustomer()]);
  const first = (order.name || '').split(' ')[0] || 'there';
  const status = order.status;
  const isPaid = ['paid', 'packed', 'dispatched', 'delivered'].includes(status);
  const awaitingBank = status === 'awaiting_payment' && order.paymentMethod === 'bank_transfer';
  const awaitingCard = status === 'awaiting_payment' && order.paymentMethod === 'card';
  const cardFailed = awaitingCard && !!sp.cancelled;
  const confirming = awaitingCard && !!sp.paid;
  const dd = dispatchDay({ cutoffHour: s.shipping.cutoffHour, closedDates: s.shipping.closedDates });
  const b = s.payments.bankTransfer;
  const signedInHere = me?.id === order.customerId;
  const canSave = !me && order.customer && !order.customer.passwordHash;

  let pill: { cls: string; text: string };
  let title: string;
  let lede: React.ReactNode;
  if (isPaid) {
    pill = { cls: 'good', text: status === 'dispatched' ? 'On its way' : status === 'delivered' ? 'Delivered' : 'Order confirmed' };
    title = status === 'dispatched' || status === 'delivered' ? `Order ${order.number}` : `Thank you, ${first}. Your order is in.`;
    lede =
      status === 'dispatched' || status === 'delivered' ? (
        <>
          {status === 'delivered' ? 'Delivered' : 'Dispatched'} {order.dispatchedAt ? fday(order.dispatchedAt) : ''}
          {order.trackingNumber ? (
            <>
              {' '}
              with tracking number <b style={{ color: 'var(--k-ink)' }}>{order.trackingNumber}</b>.
            </>
          ) : (
            '.'
          )}
        </>
      ) : (
        <>
          Order <b style={{ color: 'var(--k-ink)' }}>{order.number}</b> is confirmed and a receipt is on its way to {order.email}.{' '}
          {status === 'packed' ? 'It is packed and ready to go.' : dd.today ? 'It will be packed and dispatched today.' : `It will be dispatched ${fday(dd.d)}.`}
        </>
      );
  } else if (awaitingBank) {
    pill = { cls: 'warn', text: 'Awaiting payment' };
    title = `Thank you, ${first}. One last step.`;
    lede = (
      <>
        Order <b style={{ color: 'var(--k-ink)' }}>{order.number}</b> is reserved. Send <b style={{ color: 'var(--k-ink)' }}>{m2(order.total)}</b> by bank transfer using
        the reference <b style={{ color: 'var(--k-ink)' }}>{order.number}</b>. We dispatch as soon as it arrives. The details are also in your email.
      </>
    );
  } else if (cardFailed) {
    pill = { cls: 'warn', text: 'Payment not completed' };
    title = 'Your payment did not go through';
    lede = 'Nothing was charged. You can try your card again, or pay by bank transfer instead. Your items are reserved for now.';
  } else if (awaitingCard) {
    pill = { cls: 'warn', text: confirming ? 'Confirming payment' : 'Payment pending' };
    title = confirming ? 'Confirming your payment' : `Order ${order.number}`;
    lede = confirming ? 'We are confirming your payment with the bank. This only takes a moment and the page updates by itself.' : 'This order is waiting for card payment.';
  } else {
    pill = { cls: '', text: CUSTOMER_STATUS[status] ?? status };
    title = `Order ${order.number}`;
    lede = status === 'refunded' ? `This order was refunded (${m2(order.refundedAmount)}).` : 'This order was cancelled. No further action is needed.';
  }

  const addr = [order.shipLine1, order.shipLine2, order.shipCity, order.shipPostcode, order.shipCountry].filter(Boolean).join(', ');

  return (
    <div className="k-page">
      {confirming && <AutoRefresh seconds={3} />}
      <div className="k-wrap" style={{ maxWidth: 980 }}>
        <span className={`k-pill ${pill.cls}`}>
          {pill.cls === 'good' && <IconTick width={14} height={14} />} {pill.text}
        </span>
        <h1 className="k-h1" style={{ marginTop: 14 }}>
          {title}
        </h1>
        <p className="k-lede">{lede}</p>

        {awaitingBank && (
          <div className="k-card bankbox" style={{ marginTop: 24 }}>
            <h2 className="k-h2" style={{ fontSize: 20, marginBottom: 12 }}>
              Pay by bank transfer
            </h2>
            <dl className="bankdl">
              {(
                [
                  ['Amount', m2(order.total)],
                  ['Account name', b.accountName],
                  ['Sort code', b.sortCode],
                  ['Account number', b.accountNumber],
                  ['IBAN', b.iban],
                  ['BIC', b.bic],
                  ['Reference', order.number],
                ] as [string, string][]
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>
                      <span className="mono">{v}</span>
                      {k !== 'Amount' && <CopyButton text={v} className="k-link copy" />}
                    </dd>
                  </div>
                ))}
            </dl>
            <p className="k-small" style={{ margin: '14px 0 0' }}>
              Use the reference exactly so we can match your payment. Unpaid orders are cancelled after {b.expiryDays} days and the items go back on sale.
            </p>
          </div>
        )}

        {cardFailed && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            {cardPaymentsAvailable(s) && (
              <form action={`/api/orders/${order.accessToken}/pay`} method="post">
                <button className="k-btn">Try card payment again</button>
              </form>
            )}
            {bankTransferAvailable(s) && (
              <form action={`/api/orders/${order.accessToken}/bank`} method="post">
                <button className="k-btn ghost">Pay by bank transfer instead</button>
              </form>
            )}
          </div>
        )}

        {(isPaid || awaitingBank) && (
          <div className="k-card" style={{ marginTop: 24 }}>
            <Timeline
              stage={timelineStage(status)}
              dates={[order.createdAt, order.packedAt, order.dispatchedAt, order.deliveredAt].map((d) => (d ? fday(d) : ''))}
            />
            <p className="k-small" style={{ margin: '16px 0 0' }}>
              {order.trackingUrl ? (
                <>
                  {order.trackingCarrier} tracking{' '}
                  <a className="k-link" href={order.trackingUrl} target="_blank" rel="noopener">
                    {order.trackingNumber}
                  </a>
                  .
                </>
              ) : (
                <>
                  {order.shippingMethodName} delivery
                  {order.etaFrom ? `, expected ${fday(order.etaFrom)}${order.etaTo && +order.etaTo !== +order.etaFrom ? ` to ${fday(order.etaTo)}` : ''}` : ''}. You will get a
                  tracking link by email as soon as it ships.
                </>
              )}
            </p>
          </div>
        )}

        <div className="k-grid2" style={{ marginTop: 20, alignItems: 'start' }}>
          <div className="k-card">
            <h2 className="k-h2" style={{ fontSize: 19, marginBottom: 8 }}>
              Order details
            </h2>
            {order.items.map((l) => (
              <div className="k-sline" key={l.id}>
                <span className="th">
                  <img src={l.image} alt="" />
                  <span className="q">{l.qty}</span>
                </span>
                <span style={{ minWidth: 0 }}>
                  <b>{l.productName}</b>
                  <span>{l.packLabel}</span>
                </span>
                <span className="lp">{m2(l.lineTotal)}</span>
              </div>
            ))}
            <div className="k-tots">
              <div>
                <span>Subtotal</span>
                <span>{m2(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="save">
                  <span>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</span>
                  <span>−{m2(order.discount)}</span>
                </div>
              )}
              <div>
                <span>Delivery</span>
                <span>{order.shipping ? m2(order.shipping) : 'Free'}</span>
              </div>
              {order.credit > 0 && (
                <div className="save">
                  <span>Store credit</span>
                  <span>−{m2(order.credit)}</span>
                </div>
              )}
              <div className="grand">
                <span>{isPaid ? 'Total paid' : 'Total'}</span>
                <span>{m2(order.total)}</span>
              </div>
            </div>
            <dl className="k-review" style={{ margin: '16px 0 0', gridTemplateColumns: 'auto minmax(0,1fr)' }}>
              <dt>Ship to</dt>
              <dd>
                {order.name}, {addr}
              </dd>
              <dt>Payment</dt>
              <dd>{order.paymentDetail || (order.paymentMethod === 'card' ? 'Card' : 'Bank transfer')}</dd>
            </dl>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <a className="k-btn sm ghost" href={`/invoice/${order.accessToken}`} target="_blank" rel="noopener">
                {isPaid ? 'Invoice' : 'Pro forma invoice'}
              </a>
              <Link className="k-btn sm ghost" href={`/contact?order=${order.number}`}>
                Get help with this order
              </Link>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {signedInHere ? (
              <div className="k-card">
                <h2 className="k-h2" style={{ fontSize: 19 }}>
                  Saved to your account
                </h2>
                <p className="k-small" style={{ margin: '8px 0 14px' }}>
                  Track it and reorder in one tap from your orders page.
                </p>
                <Link className="k-btn sm" href="/account/orders">
                  View my orders
                </Link>
              </div>
            ) : canSave ? (
              <div className="k-card">
                <h2 className="k-h2" style={{ fontSize: 19 }}>
                  Save your details for next time
                </h2>
                <p className="k-small" style={{ margin: '8px 0 14px' }}>
                  Add a password to track this order, reorder in one tap and get restock alerts. Your email is already filled in.
                </p>
                <SaveAccountForm token={order.accessToken} email={order.email} />
              </div>
            ) : !me ? (
              <div className="k-card">
                <h2 className="k-h2" style={{ fontSize: 19 }}>
                  Track it in your account
                </h2>
                <p className="k-small" style={{ margin: '8px 0 14px' }}>
                  Sign in with {order.email} to see all your orders.
                </p>
                <Link className="k-btn sm" href="/account">
                  Sign in
                </Link>
              </div>
            ) : null}
            {s.referral.enabled && order.customer && isPaid && (
              <div className="k-card">
                <h2 className="k-h2" style={{ fontSize: 19 }}>
                  Give {s.referral.discountPct}%, get {money(s.referral.creditPence)}
                </h2>
                <p className="k-small" style={{ margin: '8px 0 12px' }}>
                  Share your code. Friends get {s.referral.discountPct}% off their first order and you get {money(s.referral.creditPence)} credit when it ships.
                </p>
                <div className="k-copy">
                  <span>{order.customer.referralCode}</span>
                  <CopyButton text={order.customer.referralCode} />
                </div>
              </div>
            )}
          </div>
        </div>
        <Popular />
      </div>
    </div>
  );
}
