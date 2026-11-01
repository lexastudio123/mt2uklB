import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { timelineStage } from '@/lib/orders';
import { m2 } from '@/lib/money';
import { fday } from '@/lib/eta';
import { Timeline } from '@/components/shop/timeline';
import { AccountShell, requireCustomer } from '../../shell';
import { ReorderButton } from '../../forms';

export const metadata: Metadata = { title: 'Order', robots: { index: false } };

export default async function AccountOrder({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const c = await requireCustomer(`/account/orders/${number}`);
  const o = await db.order.findFirst({ where: { number: number.toUpperCase(), customerId: c.id }, include: { items: true } });
  if (!o) {
    return (
      <AccountShell current="/account/orders" crumb="Order">
        <div className="k-empty">We could not find order {number} on this account.</div>
      </AccountShell>
    );
  }
  const stage = timelineStage(o.status);
  const closed = ['cancelled', 'refunded'].includes(o.status);
  return (
    <AccountShell current="/account/orders" crumb={`Order ${o.number}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 className="k-h2">Order {o.number}</h2>
        <ReorderButton items={o.items.map((i) => ({ packId: i.packId, qty: i.qty }))} label="Reorder all" />
      </div>
      <div className="k-card">
        {closed ? (
          <p style={{ margin: 0 }}>{o.status === 'refunded' ? `Refunded ${m2(o.refundedAmount)}.` : 'This order was cancelled.'}</p>
        ) : (
          <Timeline stage={stage} dates={[o.createdAt, o.packedAt, o.dispatchedAt, o.deliveredAt].map((d) => (d ? fday(d) : ''))} />
        )}
        {o.status === 'awaiting_payment' && (
          <p className="k-small" style={{ margin: '16px 0 0' }}>
            Waiting for payment.{' '}
            <Link className="k-link" href={`/order/${o.accessToken}`}>
              {o.paymentMethod === 'bank_transfer' ? 'See the bank details' : 'Complete payment'}
            </Link>
          </p>
        )}
        {o.trackingNumber && (
          <p className="k-small" style={{ margin: '16px 0 0' }}>
            Tracking number <b style={{ color: 'var(--k-ink)' }}>{o.trackingNumber}</b> with {o.trackingCarrier}.{' '}
            {o.trackingUrl && (
              <a className="k-link" href={o.trackingUrl} target="_blank" rel="noopener">
                Track parcel
              </a>
            )}
          </p>
        )}
      </div>
      <div className="k-card" style={{ marginTop: 16 }}>
        {o.items.map((l) => (
          <div className="k-sline" key={l.id}>
            <span className="th">
              <img src={l.image} alt="" />
              <span className="q">{l.qty}</span>
            </span>
            <span style={{ minWidth: 0 }}>
              <b>{l.productName}</b>
              <span>
                {l.packLabel}
                {l.lotCodes ? ` · Lot ${l.lotCodes}` : ''}
              </span>
            </span>
            <span className="lp">{m2(l.lineTotal)}</span>
          </div>
        ))}
        <div className="k-tots">
          <div>
            <span>Subtotal</span>
            <span>{m2(o.subtotal)}</span>
          </div>
          {o.discount > 0 && (
            <div className="save">
              <span>Discount</span>
              <span>−{m2(o.discount)}</span>
            </div>
          )}
          <div>
            <span>Delivery</span>
            <span>{o.shipping ? m2(o.shipping) : 'Free'}</span>
          </div>
          {o.credit > 0 && (
            <div className="save">
              <span>Store credit</span>
              <span>−{m2(o.credit)}</span>
            </div>
          )}
          <div className="grand">
            <span>Total</span>
            <span>{m2(o.total)}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <a className="k-btn sm ghost" href={`/invoice/${o.accessToken}`} target="_blank" rel="noopener">
          Download invoice
        </a>
        <Link className="k-btn sm ghost" href={`/contact?order=${o.number}`}>
          Get help with this order
        </Link>
      </div>
    </AccountShell>
  );
}
