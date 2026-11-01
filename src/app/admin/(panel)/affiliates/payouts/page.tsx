import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { can, requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { ago, fd } from '@/lib/admin/format';
import { m2 } from '@/lib/money';
import { approveDueCommissions, balances, readBank } from '@/lib/affiliates';
import { Empty, Flash, PageHead, Pill } from '@/components/admin/ui';

export const metadata = { title: 'Affiliate payouts' };

export default async function AffiliatePayoutsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireArea('affiliateEdit');
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  await approveDueCommissions();
  const bal = await balances();
  const dueIds = [...bal].filter(([, b]) => b.approved > 0).map(([id]) => id);
  const [due, recent] = await Promise.all([
    db.affiliate.findMany({ where: { id: { in: dueIds } }, orderBy: { name: 'asc' } }),
    db.affiliatePayout.findMany({
      orderBy: { paidAt: 'desc' },
      take: 50,
      include: { affiliate: { select: { id: true, name: true, code: true } }, admin: { select: { name: true } }, _count: { select: { commissions: true } } },
    }),
  ]);
  const total = due.reduce((n, a) => n + (bal.get(a.id)?.approved ?? 0), 0);
  const pending = [...bal.values()].reduce((n, b) => n + b.pending, 0);

  return (
    <>
      <PageHead
        crumbs={[['Affiliates', '/admin/affiliates'], ['Payouts']]}
        title="Payouts"
        sub={`${m2(total)} ready to pay to ${due.length} ${due.length === 1 ? 'affiliate' : 'affiliates'}. ${m2(pending)} more is in the ${s.affiliates.holdDays} day hold after dispatch. You pay: ${s.affiliates.payoutSchedule.charAt(0).toLowerCase()}${s.affiliates.payoutSchedule.slice(1)}.`}
        actions={
          can(admin, 'export') && due.length > 0 ? (
            <a className="a-btn ghost" href="/api/admin/export/affiliate-payouts">
              Download payment list
            </a>
          ) : undefined
        }
      />
      <Flash sp={sp} />

      <div className="a-card flush" style={{ marginBottom: 16 }}>
        <h2 className="a-h2">Ready to pay</h2>
        {due.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="a-table" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Affiliate</th>
                  <th>Bank details</th>
                  <th className="num">Amount</th>
                  <th>
                    <span className="a-sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {due.map((a) => {
                  const amount = bal.get(a.id)?.approved ?? 0;
                  const k = readBank(a);
                  const changed = a.bankUpdatedAt && Date.now() - a.bankUpdatedAt.getTime() < 14 * 864e5;
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link className="a-rowlink" href={`/admin/affiliates/${a.id}#payouts`}>
                          {a.name}
                        </Link>
                        <span className="a-small">
                          <span className="a-mono">{a.code}</span>
                          {a.status !== 'active' ? ` · ${a.status}` : ''}
                        </span>
                      </td>
                      <td>
                        {k.unreadable ? (
                          <Pill tone="red">Cannot be read</Pill>
                        ) : k.complete ? (
                          changed ? (
                            <Pill tone="amber">Changed {ago(a.bankUpdatedAt!)}</Pill>
                          ) : (
                            <Pill tone="green">On file</Pill>
                          )
                        ) : (
                          <Pill tone="red">Missing</Pill>
                        )}
                      </td>
                      <td className="num">
                        <b>{m2(amount)}</b>
                        {amount < s.affiliates.minPayout && <span className="a-small">Below the {m2(s.affiliates.minPayout)} minimum</span>}
                      </td>
                      <td>
                        <Link className="a-btn ghost sm" href={`/admin/affiliates/${a.id}#payouts`}>
                          Pay
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="a-muted" style={{ padding: '6px 20px 20px', margin: 0 }}>
            Nobody is due a payout right now. Commission becomes ready to pay {s.affiliates.holdDays} days after an order is dispatched.
          </p>
        )}
        {due.length > 0 && (
          <p className="a-small" style={{ padding: '0 20px 18px', margin: 0 }}>
            The payment list has everyone&apos;s bank details and a reference, ready for a bulk payment in your online banking. Downloading it is recorded in the
            activity log. After paying, record each payout on the affiliate&apos;s page.
          </p>
        )}
      </div>

      <div className="a-card flush">
        <h2 className="a-h2">Recent payouts</h2>
        {recent.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="a-table" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Paid</th>
                  <th>Affiliate</th>
                  <th>Reference</th>
                  <th className="num">Items</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td className="a-small" style={{ color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                      {fd(p.paidAt)}
                    </td>
                    <td>
                      <Link className="a-rowlink" href={`/admin/affiliates/${p.affiliate.id}#payouts`}>
                        {p.affiliate.name}
                      </Link>
                      <span className="a-small">{p.admin ? `Recorded by ${p.admin.name}` : ''}</span>
                    </td>
                    <td className="a-mono">{p.reference || '·'}</td>
                    <td className="num">{p._count.commissions}</td>
                    <td className="num">{m2(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No payouts yet">
            <p style={{ margin: 0 }}>Payouts you record appear here and in each affiliate&apos;s portal.</p>
          </Empty>
        )}
      </div>
    </>
  );
}
