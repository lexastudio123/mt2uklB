import Link from 'next/link';
import type { Order, OrderItem } from '@prisma/client';
import { CUSTOMER_STATUS } from '@/lib/orders';
import { m2 } from '@/lib/money';
import { ReorderButton } from './forms';

export const fdate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });

export function OrderCard({ o }: { o: Order & { items: OrderItem[] } }) {
  const pill = ['delivered', 'dispatched'].includes(o.status) ? 'good' : ['awaiting_payment', 'paid', 'packed'].includes(o.status) ? 'warn' : '';
  const n = o.items.reduce((s, i) => s + i.qty, 0);
  return (
    <div className="k-order">
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 16 }}>{o.number}</b>
          <span className={`k-pill ${pill}`}>{CUSTOMER_STATUS[o.status] ?? o.status}</span>
        </div>
        <span className="k-small">
          {fdate(o.createdAt)} · {n} {n === 1 ? 'item' : 'items'} · {m2(o.total)}
        </span>
        <div className="thumbs">
          {o.items.slice(0, 5).map((i) => (
            <span key={i.id}>
              <img src={i.image} alt="" />
            </span>
          ))}
        </div>
      </div>
      <div className="acts">
        <Link className="k-btn sm" href={`/account/orders/${o.number}`}>
          View order
        </Link>
        <ReorderButton items={o.items.map((i) => ({ packId: i.packId, qty: i.qty }))} />
      </div>
    </div>
  );
}
