import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { requireAffiliate } from '@/lib/affiliate-auth';
import { approveDueCommissions, clearsOn, orderTail, pct } from '@/lib/affiliates';
import { m2 } from '@/lib/money';
import { PortalShell, saleStatus } from '../shell';

export const metadata: Metadata = { title: 'Your sales', robots: { index: false } };

const PER = 50;

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const a = await requireAffiliate('/affiliates/portal/sales');
  await approveDueCommissions();
  const page = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1));
  const [rows, total, s] = await Promise.all([
    db.affiliateCommission.findMany({
      where: { affiliateId: a.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER,
      take: PER,
      include: { order: { select: { number: true, dispatchedAt: true, items: { select: { productName: true, packLabel: true, qty: true } } } } },
    }),
    db.affiliateCommission.count({ where: { affiliateId: a.id } }),
    getSettings(),
  ]);
  const pages = Math.ceil(total / PER);

  return (
    <PortalShell current="/affiliates/portal/sales">
      <h2 className="k-h2" style={{ marginBottom: 6 }}>
        Sales
      </h2>
      <p className="k-mute" style={{ margin: '0 0 18px', fontSize: 14.5 }}>
        Every order placed with your code, once paid. Commission is ready to pay {s.affiliates.holdDays} days after the order ships. Order numbers are shortened
        and customers&apos; details are never shown.
      </p>
      {rows.length ? (
        <div className="k-tbl">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Order value</th>
                <th>Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })}</td>
                  <td>
                    {c.kind === 'adjustment' ? (
                      <>
                        {c.amount < 0 ? 'Deduction' : 'Bonus'}
                        <br />
                        <span className="k-small">{c.description}</span>
                      </>
                    ) : (
                      <>
                        {c.kind === 'clawback' ? 'Refund after payout, order' : 'Order'} ending {c.order ? orderTail(c.order.number) : '···'}
                        {c.kind === 'sale' && c.order && (
                          <>
                            <br />
                            <span className="k-small">{c.order.items.map((i) => `${i.qty} × ${i.productName} (${i.packLabel.split(' · ')[0]})`).join(', ')}</span>
                          </>
                        )}
                      </>
                    )}
                  </td>
                  <td>{c.kind === 'sale' ? `${m2(c.basis)} at ${pct(c.rateBps)}` : '·'}</td>
                  <td style={{ color: c.amount < 0 ? 'var(--k-bad)' : undefined, textDecoration: c.status === 'void' ? 'line-through' : undefined }}>
                    <b>{m2(c.amount)}</b>
                  </td>
                  <td>{saleStatus(c, clearsOn(c.order?.dispatchedAt, s))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="k-card">
          <p className="k-mute" style={{ margin: 0 }}>
            No sales yet. Orders appear here as soon as they are paid.
          </p>
        </div>
      )}
      {pages > 1 && (
        <nav style={{ display: 'flex', gap: 16, marginTop: 18 }} aria-label="Pages">
          {page > 1 && (
            <Link className="k-link" href={`/affiliates/portal/sales?page=${page - 1}`}>
              Newer
            </Link>
          )}
          <span className="k-small">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link className="k-link" href={`/affiliates/portal/sales?page=${page + 1}`}>
              Older
            </Link>
          )}
        </nav>
      )}
    </PortalShell>
  );
}
