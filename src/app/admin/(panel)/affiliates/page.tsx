import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { can, requireArea } from '@/lib/admin/perms';
import { PER_PAGE, hrefWith, pageOf, sp1, type SP } from '@/lib/admin/queries';
import { AFFILIATE_TONE, fd } from '@/lib/admin/format';
import { m2 } from '@/lib/money';
import { AFFILIATE_STATUS_LABEL, EMPTY_BALANCE, approveDueCommissions, balances, pct } from '@/lib/affiliates';
import { Empty, Flash, Notice, PageHead, Pager, Pill, Tabs } from '@/components/admin/ui';

export const metadata = { title: 'Affiliates' };

const TABS: [string, string][] = [
  ['', 'All'],
  ['active', 'Active'],
  ['pending', 'Applications'],
  ['paused', 'Paused'],
  ['rejected', 'Rejected'],
];

export default async function AffiliatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireArea('affiliates');
  const sp = await searchParams;
  await approveDueCommissions();
  const status = TABS.some(([k]) => k && k === sp1(sp, 'status')) ? sp1(sp, 'status') : '';
  const q = sp1(sp, 'q').trim();
  const where: Prisma.AffiliateWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { code: { contains: q.toUpperCase() } }, { company: { contains: q } }] } : {}),
  };
  const page = pageOf(sp);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [rows, total, counts, s, month, owed] = await Promise.all([
    db.affiliate.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.affiliate.count({ where }),
    db.affiliate.groupBy({ by: ['status'], _count: { _all: true } }),
    getSettings(),
    db.affiliateCommission.aggregate({ where: { kind: 'sale', status: { not: 'void' }, createdAt: { gte: monthStart } }, _sum: { basis: true, amount: true }, _count: { _all: true } }),
    db.affiliateCommission.groupBy({ by: ['status'], where: { status: { in: ['pending', 'approved'] } }, _sum: { amount: true } }),
  ]);
  const count = (k: string) => counts.find((c) => c.status === k)?._count._all ?? 0;
  const owedBy = (k: string) => owed.find((o) => o.status === k)?._sum.amount ?? 0;
  const bal = await balances(rows.map((r) => r.id));
  const edit = can(admin, 'affiliateEdit');

  return (
    <>
      <PageHead
        title="Affiliates"
        sub={`${count('active')} active${count('pending') ? ` · ${count('pending')} ${count('pending') === 1 ? 'application' : 'applications'} waiting` : ''}. Partners who share your code and earn commission on the orders it brings in.`}
        actions={
          <>
            <Link className="a-btn ghost" href="/admin/affiliates/payouts">
              Payouts
            </Link>
            {can(admin, 'export') && (
              <a className="a-btn ghost" href={hrefWith('/api/admin/export/affiliates', sp, { page: null })}>
                Export CSV
              </a>
            )}
            {edit && (
              <Link className="a-btn copper" href="/admin/affiliates/new">
                Add affiliate
              </Link>
            )}
          </>
        }
      />
      <Flash sp={sp} />
      {!s.affiliates.enabled && (
        <Notice tone="err">
          The programme is switched off, so affiliate codes do not work at checkout. Turn it on in <Link href="/admin/settings?tab=affiliates">Settings › Affiliates</Link>.
        </Notice>
      )}

      <div className="a-kpis">
        <div className="a-kpi">
          <span>Active affiliates</span>
          <b>{count('active')}</b>
          <small>{count('pending') ? `${count('pending')} to review` : 'No applications waiting'}</small>
        </div>
        <div className="a-kpi">
          <span>Affiliate sales this month</span>
          <b>{m2(month._sum.basis ?? 0)}</b>
          <small>{month._count._all} {month._count._all === 1 ? 'order' : 'orders'} · {m2(month._sum.amount ?? 0)} commission</small>
        </div>
        <div className="a-kpi">
          <span>Ready to pay</span>
          <b>{m2(owedBy('approved'))}</b>
          <small>
            <Link className="a-link muted" href="/admin/affiliates/payouts">
              See who is due
            </Link>
          </small>
        </div>
        <div className="a-kpi">
          <span>Pending commission</span>
          <b>{m2(owedBy('pending'))}</b>
          <small>In the {s.affiliates.holdDays} day hold after dispatch</small>
        </div>
      </div>

      <Tabs
        items={TABS.map(([k, label]) => ({
          href: hrefWith('/admin/affiliates', sp, { status: k || null, page: null }),
          label,
          n: k ? count(k) : undefined,
          active: status === k,
        }))}
      />
      <form className="a-filters" action="/admin/affiliates">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="a-field grow">
          <label htmlFor="aq">Search</label>
          <input id="aq" name="q" defaultValue={q} placeholder="Name, email, company or code" />
        </div>
        <button className="a-btn">Search</button>
        {q && (
          <Link className="a-btn ghost" href={hrefWith('/admin/affiliates', sp, { q: null, page: null })}>
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <Empty
          title={q || status ? 'No affiliates match' : 'No affiliates yet'}
          action={
            edit && !q && !status ? (
              <Link className="a-btn copper" href="/admin/affiliates/new">
                Add your first affiliate
              </Link>
            ) : undefined
          }
        >
          <p style={{ margin: 0 }}>
            {q || status
              ? 'Try another search or tab.'
              : s.affiliates.applicationsOpen
                ? 'Applications from /affiliates/apply appear here for you to review. You can also add affiliates yourself.'
                : 'Add affiliates yourself, or open applications in Settings › Affiliates.'}
          </p>
        </Empty>
      ) : (
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Affiliate</th>
                <th>Code</th>
                <th className="num">Commission</th>
                <th className="num">Discount</th>
                <th className="num">Orders</th>
                <th className="num">Sales</th>
                <th className="num">Pending</th>
                <th className="num">Ready to pay</th>
                <th className="num">Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const b = bal.get(a.id) ?? EMPTY_BALANCE;
                return (
                  <tr key={a.id}>
                    <td>
                      <Link className="a-rowlink" href={`/admin/affiliates/${a.id}`}>
                        {a.name}
                      </Link>
                      <span className="a-small">
                        {a.email}
                        {a.company ? ` · ${a.company}` : ''}
                      </span>
                    </td>
                    <td className="a-nowrap">
                      <span className="a-code">{a.code}</span>
                    </td>
                    <td className="num">{pct(a.commissionBps)}</td>
                    <td className="num">{a.customerDiscountPct}%</td>
                    <td className="num">{b.sales}</td>
                    <td className="num">{m2(b.salesValue)}</td>
                    <td className="num">{b.pending ? m2(b.pending) : '·'}</td>
                    <td className="num">{b.approved ? <b>{m2(b.approved)}</b> : '·'}</td>
                    <td className="num">{b.paid ? m2(b.paid) : '·'}</td>
                    <td>
                      <Pill tone={AFFILIATE_TONE[a.status] ?? ''}>{AFFILIATE_STATUS_LABEL[a.status] ?? a.status}</Pill>
                      <span className="a-small">{a.status === 'pending' ? `Applied ${fd(a.createdAt)}` : a.lastLoginAt ? `Signed in ${fd(a.lastLoginAt)}` : a.passwordHash ? '' : 'No password yet'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} per={PER_PAGE} href={(p) => hrefWith('/admin/affiliates', sp, { page: p > 1 ? p : null })} />
    </>
  );
}
