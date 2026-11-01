import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { requireAffiliate } from '@/lib/affiliate-auth';
import { approveDueCommissions, balanceOf, readBank } from '@/lib/affiliates';
import { m2, money } from '@/lib/money';
import { PortalShell } from '../shell';

export const metadata: Metadata = { title: 'Your payouts', robots: { index: false } };

export default async function PayoutsPage() {
  const a = await requireAffiliate('/affiliates/portal/payouts');
  await approveDueCommissions();
  const [payouts, bal, s] = await Promise.all([
    db.affiliatePayout.findMany({ where: { affiliateId: a.id }, orderBy: { paidAt: 'desc' }, include: { _count: { select: { commissions: true } } } }),
    balanceOf(a.id),
    getSettings(),
  ]);
  const p = s.affiliates;
  const bank = readBank(a);
  return (
    <PortalShell current="/affiliates/portal/payouts">
      <h2 className="k-h2" style={{ marginBottom: 6 }}>
        Payouts
      </h2>
      <p className="k-mute" style={{ margin: '0 0 18px', fontSize: 14.5 }}>
        We pay {p.payoutSchedule.charAt(0).toLowerCase() + p.payoutSchedule.slice(1)}, once at least {money(p.minPayout)} is ready to pay. Smaller balances roll over.
      </p>
      <div className="k-card" style={{ marginBottom: 22 }}>
        <p style={{ margin: 0 }}>
          <b>{m2(bal.approved)}</b> is ready for your next payout{bal.pending ? `, and ${m2(bal.pending)} is still in its hold period` : ''}.
        </p>
        <p className="k-small" style={{ margin: '8px 0 0' }}>
          {bank.complete ? (
            <>
              Paid to {bank.accountName}, account {bank.accountNumber ? `ending ${bank.accountNumber.slice(-4)}` : `IBAN ending ${bank.iban.slice(-4)}`}.{' '}
              <Link className="k-link" href="/affiliates/portal/details#bank">
                Change
              </Link>
            </>
          ) : (
            <>
              We do not have your bank details yet.{' '}
              <Link className="k-link" href="/affiliates/portal/details#bank">
                Add them now
              </Link>
            </>
          )}
        </p>
      </div>
      {payouts.length ? (
        <div className="k-tbl">
          <table>
            <thead>
              <tr>
                <th>Paid on</th>
                <th>Reference</th>
                <th>Sales covered</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((po) => (
                <tr key={po.id}>
                  <td>{po.paidAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{po.reference || '·'}</td>
                  <td>{po._count.commissions}</td>
                  <td>
                    <b>{m2(po.amount)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="k-card">
          <p className="k-mute" style={{ margin: 0 }}>
            No payouts yet. Your first one is sent once at least {money(p.minPayout)} is ready to pay.
          </p>
        </div>
      )}
    </PortalShell>
  );
}
