import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { getCatalog } from '@/lib/catalog';
import { requireAffiliate } from '@/lib/affiliate-auth';
import { approveDueCommissions, balanceOf, clearsOn, monthlyStats, orderTail, pct, readBank } from '@/lib/affiliates';
import { siteUrl } from '@/lib/site';
import { m2, money } from '@/lib/money';
import { CopyButton } from '@/components/shop/bits';
import { LinkBuilder } from '../forms';
import { PortalShell, saleStatus } from './shell';

export const metadata: Metadata = { title: 'Affiliate portal', robots: { index: false } };

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const a = await requireAffiliate('/affiliates/portal');
  await approveDueCommissions();
  const [sp, s, bal, months, recent, catalog] = await Promise.all([
    searchParams,
    getSettings(),
    balanceOf(a.id),
    monthlyStats(a.id),
    db.affiliateCommission.findMany({
      where: { affiliateId: a.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { order: { select: { number: true, dispatchedAt: true } } },
    }),
    getCatalog(),
  ]);
  const bank = readBank(a);
  const p = s.affiliates;
  const pages: [string, string][] = [
    ['/', 'Home page'],
    ['/shop', 'Shop'],
    ...catalog.map((c): [string, string] => [`/products/${c.slug}`, c.name]),
    ['/science', 'MT1 vs MT2 science'],
    ['/lot-reports', 'Lot reports'],
  ];
  const first = a.name.split(' ')[0];

  return (
    <PortalShell current="/affiliates/portal">
      {sp.welcome && <div className="k-flash good">Your password is set. Welcome to the portal, {first}.</div>}
      {a.status === 'paused' && (
        <div className="k-note" style={{ marginBottom: 18 }}>
          Your account is paused, so your code does not work at checkout at the moment. Your sales and payouts are still here. Questions? Email {s.supportEmail}.
        </div>
      )}
      {!bank.complete && (
        <div className="k-note" style={{ marginBottom: 18 }}>
          Add your bank details so we can pay you.{' '}
          <Link className="k-link" href="/affiliates/portal/details#bank">
            Add bank details
          </Link>
        </div>
      )}
      <h2 className="k-h2" style={{ marginBottom: 16 }}>
        Hello, {first}
      </h2>
      <div className="k-stats">
        <div>
          <b>{m2(Math.abs(bal.approved))}</b>
          <span>{bal.approved < 0 ? 'To come off your next payout' : 'Ready to pay'}</span>
        </div>
        <div>
          <b>{m2(bal.pending)}</b>
          <span>Pending ({p.holdDays} days after dispatch)</span>
        </div>
        <div>
          <b>{m2(bal.paid)}</b>
          <span>Paid to you so far</span>
        </div>
      </div>

      <div className="k-grid2" style={{ marginTop: 22, alignItems: 'start' }}>
        <div className="k-card">
          <h3 className="k-h3" style={{ margin: '0 0 10px' }}>
            Your code
          </h3>
          <div className="k-copy">
            <span>{a.code}</span>
            <CopyButton text={a.code} label="Copy code" />
          </div>
          <p className="k-small" style={{ margin: '12px 0 0' }}>
            {a.customerDiscountPct > 0 ? `Customers get ${a.customerDiscountPct}% off with it. ` : ''}You earn {pct(a.commissionBps)} of the order value after discounts,
            excluding delivery, on every order placed with it.
          </p>
        </div>
        <div className="k-card">
          <h3 className="k-h3" style={{ margin: '0 0 10px' }}>
            Your link
          </h3>
          <LinkBuilder base={siteUrl()} code={a.code} pages={pages} />
          <p className="k-small" style={{ margin: '12px 0 0' }}>
            Everyone who follows it is offered your code and can add it in one tap.
          </p>
        </div>
      </div>

      <h2 className="k-h2" style={{ margin: '34px 0 12px' }}>
        By month
      </h2>
      <div className="k-tbl">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Link visits</th>
              <th>Orders</th>
              <th>Order value</th>
              <th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>{m.clicks}</td>
                <td>{m.orders}</td>
                <td>{m2(m.sales)}</td>
                <td>
                  <b>{m2(m.commission)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, margin: '34px 0 12px', flexWrap: 'wrap' }}>
        <h2 className="k-h2" style={{ margin: 0 }}>
          Latest activity
        </h2>
        {recent.length > 0 && (
          <Link className="k-link" href="/affiliates/portal/sales" style={{ fontSize: 14.5 }}>
            All sales
          </Link>
        )}
      </div>
      {recent.length ? (
        <div className="k-tbl">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>For</th>
                <th>Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td>{c.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' })}</td>
                  <td>
                    {c.kind === 'adjustment' ? (c.amount < 0 ? 'Deduction' : 'Bonus') : c.kind === 'clawback' ? 'Refund after payout' : 'Order'}
                    {c.order ? ` ending ${orderTail(c.order.number)}` : c.description ? `: ${c.description}` : ''}
                  </td>
                  <td style={{ color: c.amount < 0 ? 'var(--k-bad)' : undefined }}>{m2(c.amount)}</td>
                  <td>{saleStatus(c, clearsOn(c.order?.dispatchedAt, s))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="k-card">
          <p className="k-mute" style={{ margin: 0 }}>
            No sales yet. Share your link or code, and orders appear here as soon as they are paid.
          </p>
        </div>
      )}
      <p className="k-small" style={{ marginTop: 22 }}>
        We pay {p.payoutSchedule.charAt(0).toLowerCase() + p.payoutSchedule.slice(1)}, once at least {money(p.minPayout)} is ready to pay.{' '}
        <Link className="k-link" href="/affiliates/terms">
          Programme rules
        </Link>
      </p>
    </PortalShell>
  );
}
