import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { fdt } from '@/lib/admin/format';
import { m2 } from '@/lib/money';
import { Flash, OrderPill, PageHead } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import { DiscountFields } from '@/components/admin/discount-form';
import { deleteDiscountAction, updateDiscountAction } from '../actions';

export const metadata = { title: 'Discount' };

export default async function DiscountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requireArea('discounts');
  const { id } = await params;
  const sp = await searchParams;
  const d = await db.discountCode.findUnique({ where: { id } });
  if (!d) notFound();
  const orders = await db.order.findMany({ where: { discountCode: d.code }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, number: true, name: true, status: true, discount: true, total: true, createdAt: true } });
  const savedTotal = orders.reduce((n, o) => n + (o.status === 'cancelled' ? 0 : o.discount), 0);
  return (
    <>
      <PageHead crumbs={[['Discounts', '/admin/discounts'], [d.code]]} title={<span className="a-mono" style={{ fontFamily: 'var(--display)' }}>{d.code}</span>} sub={`Created ${fdt(d.createdAt)} · used ${d.usedCount} ${d.usedCount === 1 ? 'time' : 'times'}`} />
      <Flash sp={sp} />
      <div className="a-split">
        <div className="a-card">
          <form action={updateDiscountAction}>
            <input type="hidden" name="id" value={d.id} />
            <DiscountFields d={d} />
          </form>
        </div>
        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">Recent orders with this code</h2>
            {orders.length ? (
              <>
                {orders.map((o) => (
                  <div key={o.id} className="a-kv">
                    <span>
                      <Link className="a-link a-mono" href={`/admin/orders/${o.id}`}>
                        {o.number}
                      </Link>{' '}
                      <span className="a-small" style={{ display: 'inline' }}>
                        {o.name}
                      </span>
                    </span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <OrderPill status={o.status} />
                      <b>−{m2(o.discount)}</b>
                    </span>
                  </div>
                ))}
                <p className="a-small" style={{ margin: '10px 0 0' }}>
                  {m2(savedTotal)} given in discounts on these orders.
                </p>
              </>
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                Not used yet.
              </p>
            )}
          </div>
          <div className="a-card a-danger-zone">
            <h2 className="a-h2">Delete</h2>
            <p className="a-small" style={{ margin: '0 0 10px' }}>
              Codes that have been used are kept for the record; switch them off instead.
            </p>
            <form action={deleteDiscountAction}>
              <input type="hidden" name="id" value={d.id} />
              <SubmitButton className="a-btn danger" confirm={`Delete ${d.code}?`}>
                Delete code
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
