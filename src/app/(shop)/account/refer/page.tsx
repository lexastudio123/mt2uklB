import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { m2, money } from '@/lib/money';
import { CopyButton } from '@/components/shop/bits';
import { AccountShell, requireCustomer } from '../shell';

export const metadata: Metadata = { title: 'Refer a friend', robots: { index: false } };

export default async function ReferPage() {
  const c = await requireCustomer('/account/refer');
  const [s, referred, ledger] = await Promise.all([
    getSettings(),
    db.order.count({ where: { referrerId: c.id, status: { in: ['dispatched', 'delivered'] } } }),
    db.creditEntry.findMany({ where: { customerId: c.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  const R = s.referral;
  return (
    <AccountShell current="/account/refer">
      <h2 className="k-h2" style={{ marginBottom: 8 }}>
        Give {R.discountPct}%, get {money(R.creditPence)}
      </h2>
      <p className="k-lede" style={{ marginTop: 0 }}>
        Share your code. Friends get {R.discountPct}% off their first order and you get {money(R.creditPence)} credit when their order ships.
      </p>
      {R.enabled ? (
        <div className="k-copy" style={{ maxWidth: 420, marginTop: 18 }}>
          <span>{c.referralCode}</span>
          <CopyButton text={c.referralCode} />
        </div>
      ) : (
        <div className="k-note" style={{ marginTop: 18 }}>
          Referrals are paused at the moment.
        </div>
      )}
      <ol className="k-steps3" style={{ marginTop: 26 }}>
        <li>
          <b>Share your code</b>Send it to a friend or colleague.
        </li>
        <li>
          <b>They save on their first order</b>Their discount applies at checkout.
        </li>
        <li>
          <b>You get credit</b>Credit lands in your account once their order ships and is used automatically at your next checkout.
        </li>
      </ol>
      <div className="k-stats" style={{ marginTop: 26 }}>
        <div>
          <b>{referred}</b>
          <span>Friends referred</span>
        </div>
        <div>
          <b>{m2(c.creditPence)}</b>
          <span>Credit available</span>
        </div>
        <div>
          <b>{m2(ledger.filter((e) => e.amount > 0).reduce((t, e) => t + e.amount, 0))}</b>
          <span>Credit earned</span>
        </div>
      </div>
      {ledger.length > 0 && (
        <div className="k-tbl" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Detail</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id}>
                  <td>{e.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{e.reason}</td>
                  <td>{e.amount > 0 ? `+${m2(e.amount)}` : m2(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  );
}
