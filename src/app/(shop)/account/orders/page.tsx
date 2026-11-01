import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { AccountShell, requireCustomer } from '../shell';
import { OrderCard } from '../order-card';

export const metadata: Metadata = { title: 'Orders', robots: { index: false } };

export default async function OrdersPage() {
  const c = await requireCustomer('/account/orders');
  const orders = await db.order.findMany({ where: { customerId: c.id }, orderBy: { createdAt: 'desc' }, include: { items: true }, take: 100 });
  return (
    <AccountShell current="/account/orders">
      <h2 className="k-h2" style={{ marginBottom: 16 }}>
        Orders
      </h2>
      {orders.length ? (
        <div className="k-orders">
          {orders.map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
        </div>
      ) : (
        <div className="k-empty">
          <p style={{ margin: 0 }}>You have not placed an order with this account yet.</p>
          <Link className="k-btn" href="/shop">
            Browse the range
          </Link>
        </div>
      )}
    </AccountShell>
  );
}
