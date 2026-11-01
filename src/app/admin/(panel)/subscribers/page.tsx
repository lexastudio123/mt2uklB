import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireArea } from '@/lib/admin/perms';
import { PER_PAGE, hrefWith, pageOf, sp1, type SP } from '@/lib/admin/queries';
import { fd } from '@/lib/admin/format';
import { Empty, Flash, PageHead, Pager, Pill, Tabs } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import { addSubscriberAction, deleteSubscriberAction, toggleSubscriberAction } from './actions';

export const metadata = { title: 'Subscribers' };

const SOURCE: Record<string, string> = { footer: 'Footer sign-up', popup: 'Discount pop-up', checkout: 'Checkout', account: 'Account page', admin: 'Added by the team' };

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('subscribers');
  const sp = await searchParams;
  const page = pageOf(sp);
  const status = sp1(sp, 'status') || 'active';
  const q = sp1(sp, 'q').toLowerCase();
  const base: Prisma.SubscriberWhereInput = q ? { email: { contains: q } } : {};
  const where: Prisma.SubscriberWhereInput = { ...base, ...(status === 'active' ? { unsubscribedAt: null } : status === 'unsubscribed' ? { unsubscribedAt: { not: null } } : {}) };
  const [rows, total, active, gone, alerts] = await Promise.all([
    db.subscriber.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.subscriber.count({ where }),
    db.subscriber.count({ where: { ...base, unsubscribedAt: null } }),
    db.subscriber.count({ where: { ...base, unsubscribedAt: { not: null } } }),
    db.productAlert.groupBy({ by: ['productId'], _count: { _all: true } }),
  ]);
  const products = alerts.length ? await db.product.findMany({ where: { id: { in: alerts.map((x) => x.productId) } }, select: { id: true, name: true } }) : [];
  const here = hrefWith('/admin/subscribers', sp, {});
  return (
    <>
      <PageHead
        title="Subscribers"
        sub="People who asked for new lot and offer emails. Every marketing email carries an unsubscribe link."
        actions={
          <a className="a-btn ghost" href={hrefWith('/api/admin/export/subscribers', sp, { page: null, status })}>
            Export CSV
          </a>
        }
      />
      <Flash sp={sp} />
      <div className="a-split" style={{ marginBottom: 0 }}>
        <div>
          <Tabs
            items={[
              { href: hrefWith('/admin/subscribers', sp, { status: null, page: null }), label: 'Subscribed', n: active, active: status === 'active' },
              { href: hrefWith('/admin/subscribers', sp, { status: 'unsubscribed', page: null }), label: 'Unsubscribed', n: gone, active: status === 'unsubscribed' },
              { href: hrefWith('/admin/subscribers', sp, { status: 'all', page: null }), label: 'All', n: active + gone, active: status === 'all' },
            ]}
          />
          <form className="a-filters" action="/admin/subscribers">
            {status !== 'active' && <input type="hidden" name="status" value={status} />}
            <div className="a-field grow">
              <label htmlFor="sq">Search</label>
              <input id="sq" name="q" defaultValue={q} placeholder="Email" />
            </div>
            <button className="a-btn">Search</button>
          </form>
          {rows.length === 0 ? (
            <Empty title="No subscribers here">
              <p style={{ margin: 0 }}>Sign-ups from the footer, the discount pop-up and checkout appear here.</p>
            </Empty>
          ) : (
            <div className="a-tablewrap">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Source</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link className="a-link muted" href={`/admin/customers?q=${encodeURIComponent(s.email)}`}>
                          {s.email}
                        </Link>
                      </td>
                      <td className="a-small" style={{ color: 'var(--ink)' }}>
                        {SOURCE[s.source] ?? s.source}
                      </td>
                      <td className="a-small" style={{ color: 'var(--ink)' }}>
                        {fd(s.createdAt)}
                      </td>
                      <td>{s.unsubscribedAt ? <Pill>Unsubscribed {fd(s.unsubscribedAt)}</Pill> : <Pill tone="green">Subscribed</Pill>}</td>
                      <td className="a-right a-nowrap">
                        <form action={toggleSubscriberAction} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="return" value={here} />
                          <SubmitButton className="a-btn ghost sm">{s.unsubscribedAt ? 'Resubscribe' : 'Unsubscribe'}</SubmitButton>
                        </form>{' '}
                        <form action={deleteSubscriberAction} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="return" value={here} />
                          <SubmitButton className="a-btn danger sm" confirm={`Delete ${s.email} from the list completely?`}>
                            Delete
                          </SubmitButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} total={total} per={PER_PAGE} href={(p) => hrefWith('/admin/subscribers', sp, { page: p > 1 ? p : null })} />
        </div>
        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">Add a subscriber</h2>
            <form action={addSubscriberAction} className="a-form">
              <input type="hidden" name="return" value={here} />
              <div className="a-field">
                <label htmlFor="se">Email</label>
                <input id="se" name="email" type="email" required />
              </div>
              <label className="a-check">
                <input type="checkbox" name="consent" />
                They asked to receive these emails
              </label>
              <SubmitButton className="a-btn">Add</SubmitButton>
            </form>
          </div>
          <div className="a-card">
            <h2 className="a-h2">Restock and new lot alerts</h2>
            {alerts.length ? (
              alerts.map((x) => (
                <div key={x.productId} className="a-kv">
                  <span>{products.find((p) => p.id === x.productId)?.name ?? 'Deleted product'}</span>
                  <b>{x._count._all}</b>
                </div>
              ))
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                Nobody has asked for product alerts yet.
              </p>
            )}
            <p className="a-small" style={{ margin: '10px 0 0' }}>
              Send them from the current lot&apos;s page under Lot reports.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
