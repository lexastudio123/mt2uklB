import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { expireStaleOrders } from '@/lib/orders';
import { can, requireArea } from '@/lib/admin/perms';
import { dashboardKpis, launchChecklist, revenueSeries } from '@/lib/admin/stats';
import { ago, PAYMENT_LABEL } from '@/lib/admin/format';
import { m2, money } from '@/lib/money';
import { Flash, OrderPill, PageHead } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/icons';
import { RevenueChart } from '@/components/admin/revenue-chart';

export const metadata = { title: 'Dashboard' };

function greeting() {
  const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/London' }));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireArea('dashboard');
  const sp = await searchParams;
  await expireStaleOrders();
  const settings = await getSettings();
  const series = await revenueSeries(30);
  const [k, checklist, recent, tickets] = await Promise.all([
    dashboardKpis(series),
    can(admin, 'settings') ? launchChecklist(settings) : Promise.resolve([]),
    db.order.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { items: { select: { qty: true, productCode: true, packQty: true } } } }),
    db.ticket.findMany({ where: { status: 'open' }, take: 6, orderBy: { lastMessageAt: 'desc' }, include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
  ]);
  const todo = checklist.filter((c) => !c.done);
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });

  return (
    <>
      <PageHead title="Dashboard" sub={`${greeting()}, ${admin.name.split(' ')[0]}. ${today}.`} actions={<Link className="a-btn ghost" href="/admin/orders?status=paid">Orders to pack</Link>} />
      <Flash sp={sp} />

      {todo.length > 0 && (
        <div className="a-card tint" style={{ marginBottom: 16 }}>
          <h2 className="a-h2">
            Launch checklist · {checklist.length - todo.length} of {checklist.length} done
          </h2>
          <ul className="a-checklist">
            {checklist.map((c) => (
              <li key={c.label} className={c.done ? 'done' : 'todo'}>
                <span className="ic" aria-hidden="true">
                  <AdminIcon name={c.done ? 'tick' : 'alert'} />
                </span>
                <span>
                  <b>
                    {c.done ? '' : 'To do: '}
                    {c.label}
                  </b>
                  {!c.done && (
                    <>
                      {' · '}
                      <Link href={c.href}>Fix</Link>
                    </>
                  )}
                  <small>{c.detail}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="a-kpis">
        <div className="a-kpi">
          <span>Revenue today</span>
          <b>{money(k.today.revenue)}</b>
          <small>{k.today.orders} paid {k.today.orders === 1 ? 'order' : 'orders'}</small>
        </div>
        <div className="a-kpi">
          <span>Last 7 days</span>
          <b>{money(k.week.revenue)}</b>
          <small>{k.week.orders} paid {k.week.orders === 1 ? 'order' : 'orders'}</small>
        </div>
        <div className="a-kpi">
          <span>Last 30 days</span>
          <b>{money(k.month.revenue)}</b>
          <small>
            {k.month.orders} paid · {k.aov ? `${m2(k.aov)} average` : 'no orders yet'}
          </small>
        </div>
        <Link className={`a-kpi${k.toPack ? ' alert' : ''}`} href="/admin/orders?status=paid">
          <span>Paid, to pack</span>
          <b>{k.toPack}</b>
          <small>{k.packed ? `${k.packed} packed, ready to dispatch` : 'Nothing waiting to dispatch'}</small>
        </Link>
        <Link className="a-kpi" href="/admin/orders?status=awaiting_payment">
          <span>Awaiting payment</span>
          <b>{k.awaiting}</b>
          <small>Bank transfers and open card checkouts</small>
        </Link>
        <Link className={`a-kpi${k.openTickets ? ' alert' : ''}`} href="/admin/inbox">
          <span>Open conversations</span>
          <b>{k.openTickets}</b>
          <small>{k.openTickets ? 'Customers waiting for a reply' : 'Inbox is clear'}</small>
        </Link>
        <Link className={`a-kpi${k.lowStock.length ? ' alert' : ''}`} href="/admin/products">
          <span>Low stock</span>
          <b>{k.lowStock.length}</b>
          <small>{k.lowStock.length ? k.lowStock.map((p) => `${p.code} ${p.stock}`).join(' · ') : 'All products above their threshold'}</small>
        </Link>
        <div className="a-kpi">
          <span>Orders placed, 30 days</span>
          <b>{k.placed30}</b>
          <small>Excluding cancelled</small>
        </div>
      </div>

      <div className="a-card" style={{ marginBottom: 16 }}>
        <h2 className="a-h2">
          Revenue, last 30 days
          <span className="a-small" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--sans)' }}>
            Paid orders by payment date, net of refunds
          </span>
        </h2>
        <RevenueChart data={series} />
        <div className="a-chartfoot">
          <span>
            Total {m2(k.month.revenue)} from {k.month.orders} {k.month.orders === 1 ? 'order' : 'orders'}
          </span>
          <details>
            <summary>Show as a table</summary>
            <table className="a-table compact" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="num">Orders</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {series
                  .slice()
                  .reverse()
                  .map((d) => (
                    <tr key={d.key}>
                      <td>{d.long}</td>
                      <td className="num">{d.orders}</td>
                      <td className="num">{m2(d.revenue)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        </div>
      </div>

      <div className="a-split">
        <div className="a-card flush">
          <h2 className="a-h2">
            Recent orders <Link href="/admin/orders">All orders</Link>
          </h2>
          {recent.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="a-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link className="a-rowlink a-mono" href={`/admin/orders/${o.id}`}>
                          {o.number}
                        </Link>
                        <span className="a-small">{ago(o.createdAt)}</span>
                      </td>
                      <td>
                        {o.name}
                        <span className="a-small">
                          {o.items.map((i) => `${i.qty}× ${i.productCode}${i.packQty > 1 ? ` (${i.packQty})` : ''}`).join(', ')}
                        </span>
                      </td>
                      <td>
                        <OrderPill status={o.status} />
                        <span className="a-small">{PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
                      </td>
                      <td className="num">{m2(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="a-muted" style={{ padding: '6px 20px 20px', margin: 0 }}>
              No orders yet. They appear here as soon as someone checks out.
            </p>
          )}
        </div>
        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">
              Open conversations <Link href="/admin/inbox">Inbox</Link>
            </h2>
            {tickets.length ? (
              tickets.map((t) => (
                <Link key={t.id} href={`/admin/inbox/${t.id}`} className="a-kv" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                    <span className="a-small">{ago(t.lastMessageAt)}</span>
                  </span>
                  <span className="a-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.topic} · {t.messages[0]?.body.slice(0, 90)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                No open conversations.
              </p>
            )}
          </div>
          <div className="a-card">
            <h2 className="a-h2">
              Stock <Link href="/admin/products">Products</Link>
            </h2>
            {k.lowStock.length ? (
              k.lowStock.map((p) => (
                <div key={p.id} className="a-kv">
                  <span>
                    {p.name} <span className="a-pill amber">Low</span>
                  </span>
                  <b>{p.stock} left</b>
                </div>
              ))
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                Every product is above its low stock level.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
