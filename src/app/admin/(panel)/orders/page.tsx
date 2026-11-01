import Link from 'next/link';
import { db } from '@/lib/db';
import { expireStaleOrders } from '@/lib/orders';
import { can, requireArea } from '@/lib/admin/perms';
import { ORDER_TABS, PER_PAGE, hrefWith, ordersWhere, pageOf, sp1, type SP } from '@/lib/admin/queries';
import { ago, fdt, PAYMENT_LABEL } from '@/lib/admin/format';
import { m2 } from '@/lib/money';
import { Empty, Flash, OrderPill, PageHead, Pager, PaymentPill, Tabs } from '@/components/admin/ui';
import { CheckAll, SubmitButton } from '@/components/admin/client';
import { bulkPackAction } from './actions';

export const metadata = { title: 'Orders' };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireArea('orders');
  const sp = await searchParams;
  await expireStaleOrders();
  const page = pageOf(sp);
  const status = sp1(sp, 'status');
  const where = ordersWhere(sp);
  const [rows, total, groups] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { items: { select: { qty: true, productCode: true, packQty: true } } },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ['status'], where: ordersWhere(sp, { ignoreStatus: true }), _count: { _all: true } }),
  ]);
  const count = (s: string) => (s ? groups.find((g) => g.status === s)?._count._all ?? 0 : groups.reduce((n, g) => n + g._count._all, 0));
  const here = hrefWith('/admin/orders', sp, {});
  const filtered = !!(sp1(sp, 'q') || sp1(sp, 'from') || sp1(sp, 'to') || sp1(sp, 'pay'));

  return (
    <>
      <PageHead
        title="Orders"
        sub="Everything placed on the shop. Bank transfers wait in “Awaiting payment” until you mark them paid."
        actions={
          can(admin, 'export') ? (
            <a className="a-btn ghost" href={hrefWith('/api/admin/export/orders', sp, { page: null })}>
              Export CSV
            </a>
          ) : undefined
        }
      />
      <Flash sp={sp} />
      <Tabs items={ORDER_TABS.map(([s, label]) => ({ href: hrefWith('/admin/orders', sp, { status: s || null, page: null }), label, n: count(s), active: status === s }))} />

      <form className="a-filters" action="/admin/orders">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="a-field grow">
          <label htmlFor="oq">Search</label>
          <input id="oq" name="q" defaultValue={sp1(sp, 'q')} placeholder="Order number, email, name, postcode or tracking" />
        </div>
        <div className="a-field">
          <label htmlFor="of">From</label>
          <input id="of" type="date" name="from" defaultValue={sp1(sp, 'from')} />
        </div>
        <div className="a-field">
          <label htmlFor="ot">To</label>
          <input id="ot" type="date" name="to" defaultValue={sp1(sp, 'to')} />
        </div>
        <div className="a-field">
          <label htmlFor="op">Payment</label>
          <select id="op" name="pay" defaultValue={sp1(sp, 'pay')}>
            <option value="">Any</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="credit">Store credit</option>
          </select>
        </div>
        <button className="a-btn">Filter</button>
        {filtered && (
          <Link className="a-btn ghost" href={hrefWith('/admin/orders', {}, { status: status || null })}>
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty title={filtered || status ? 'No orders match' : 'No orders yet'}>
          <p style={{ margin: 0 }}>{filtered || status ? 'Try another tab or clear the filters.' : 'Orders appear here as soon as someone checks out.'}</p>
        </Empty>
      ) : (
        <form>
          <input type="hidden" name="return" value={here} />
          <input type="hidden" name="print" value="1" />
          <div className="a-tablewrap">
            <div className="a-bulk">
              <span>With selected:</span>
              <button className="a-btn ghost sm" formAction="/admin/orders/slips" formMethod="get" formTarget="_blank">
                Print packing slips
              </button>
              <SubmitButton className="a-btn ghost sm" formAction={bulkPackAction} pending="Packing…" confirm="Mark the selected paid orders as packed, recording each item's current lot?">
                Mark packed
              </SubmitButton>
            </div>
            <table className="a-table">
              <thead>
                <tr>
                  <th className="chk">
                    <CheckAll name="ids" label="Select all orders on this page" />
                  </th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className="chk">
                      <input type="checkbox" name="ids" value={o.id} aria-label={`Select ${o.number}`} />
                    </td>
                    <td>
                      <Link className="a-rowlink a-mono" href={`/admin/orders/${o.id}`}>
                        {o.number}
                      </Link>
                      <span className="a-small" title={fdt(o.createdAt)}>
                        {ago(o.createdAt)}
                      </span>
                    </td>
                    <td>
                      {o.name}
                      <span className="a-small">
                        {o.email} · {o.shipPostcode}
                      </span>
                    </td>
                    <td className="a-small" style={{ color: 'var(--ink)' }}>
                      {o.items.map((i) => `${i.qty} × ${i.productCode}${i.packQty > 1 ? ` (${i.packQty})` : ''}`).join(', ')}
                    </td>
                    <td>
                      <PaymentPill status={o.paymentStatus} />
                      <span className="a-small">{PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
                    </td>
                    <td>
                      <OrderPill status={o.status} />
                      {o.trackingNumber && <span className="a-small a-mono">{o.trackingNumber}</span>}
                    </td>
                    <td className="num">
                      {m2(o.total)}
                      {o.refundedAmount > 0 && <span className="a-small">−{m2(o.refundedAmount)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}
      <Pager page={page} total={total} per={PER_PAGE} href={(p) => hrefWith('/admin/orders', sp, { page: p > 1 ? p : null })} />
    </>
  );
}
