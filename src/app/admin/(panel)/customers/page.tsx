import Link from 'next/link';
import { db } from '@/lib/db';
import { can, requireArea } from '@/lib/admin/perms';
import { PER_PAGE, customerTotals, customersWhere, hrefWith, pageOf, sp1, type SP } from '@/lib/admin/queries';
import { fd } from '@/lib/admin/format';
import { m2 } from '@/lib/money';
import { Empty, Flash, PageHead, Pager, Pill } from '@/components/admin/ui';

export const metadata = { title: 'Customers' };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireArea('customers');
  const sp = await searchParams;
  const page = pageOf(sp);
  const where = customersWhere(sp);
  const [rows, total, all] = await Promise.all([
    db.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.customer.count({ where }),
    db.customer.count(),
  ]);
  const totals = await customerTotals(rows.map((c) => c.id));
  const filtered = ['q', 'account', 'marketing', 'tag', 'blocked'].some((k) => sp1(sp, k));

  return (
    <>
      <PageHead
        title="Customers"
        sub={`${all} ${all === 1 ? 'customer' : 'customers'}. Everyone who has ordered, created an account or been added from a conversation.`}
        actions={
          can(admin, 'export') ? (
            <a className="a-btn ghost" href={hrefWith('/api/admin/export/customers', sp, { page: null })}>
              Export CSV
            </a>
          ) : undefined
        }
      />
      <Flash sp={sp} />
      <form className="a-filters" action="/admin/customers">
        <div className="a-field grow">
          <label htmlFor="cq">Search</label>
          <input id="cq" name="q" defaultValue={sp1(sp, 'q')} placeholder="Name, email, phone or referral code" />
        </div>
        <div className="a-field">
          <label htmlFor="ca">Account</label>
          <select id="ca" name="account" defaultValue={sp1(sp, 'account')}>
            <option value="">Anyone</option>
            <option value="yes">Has an account</option>
            <option value="no">Guest only</option>
          </select>
        </div>
        <div className="a-field">
          <label htmlFor="cm">Marketing</label>
          <select id="cm" name="marketing" defaultValue={sp1(sp, 'marketing')}>
            <option value="">Anyone</option>
            <option value="yes">Opted in</option>
          </select>
        </div>
        <div className="a-field">
          <label htmlFor="ct">Tag</label>
          <input id="ct" name="tag" defaultValue={sp1(sp, 'tag')} placeholder="e.g. trade" />
        </div>
        <div className="a-field">
          <label htmlFor="cb">Blocked</label>
          <select id="cb" name="blocked" defaultValue={sp1(sp, 'blocked')}>
            <option value="">Any</option>
            <option value="yes">Blocked only</option>
          </select>
        </div>
        <button className="a-btn">Filter</button>
        {filtered && (
          <Link className="a-btn ghost" href="/admin/customers">
            Clear
          </Link>
        )}
      </form>
      {rows.length === 0 ? (
        <Empty title={filtered ? 'No customers match' : 'No customers yet'}>
          <p style={{ margin: 0 }}>{filtered ? 'Clear the filters to see everyone.' : 'Customers are created automatically when someone orders or signs up.'}</p>
        </Empty>
      ) : (
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Orders</th>
                <th className="num">Spent</th>
                <th>Last order</th>
                <th>Tags</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const t = totals.get(c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link className="a-rowlink" href={`/admin/customers/${c.id}`}>
                        {c.name || c.email}
                      </Link>
                      <span className="a-small">{c.email}</span>
                    </td>
                    <td className="num">{t?.orders ?? 0}</td>
                    <td className="num">{m2(t?.spent ?? 0)}</td>
                    <td className="a-small" style={{ color: 'var(--ink)' }}>
                      {t?.last ? fd(t.last) : '·'}
                    </td>
                    <td>
                      {c.tags
                        .split(',')
                        .filter(Boolean)
                        .map((tag) => (
                          <span key={tag} className="a-tag">
                            {tag}
                          </span>
                        ))}
                    </td>
                    <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.blocked ? <Pill tone="red">Blocked</Pill> : <Pill tone={c.passwordHash ? 'green' : ''}>{c.passwordHash ? 'Account' : 'Guest'}</Pill>}
                      {c.marketingOptIn && <Pill tone="blue">Emails</Pill>}
                    </td>
                    <td className="a-small" style={{ color: 'var(--ink)' }}>
                      {fd(c.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} per={PER_PAGE} href={(p) => hrefWith('/admin/customers', sp, { page: p > 1 ? p : null })} />
    </>
  );
}
