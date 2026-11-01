import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { fd } from '@/lib/admin/format';
import { m2, money } from '@/lib/money';
import { Empty, Flash, PageHead, Pill } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import { toggleDiscountAction } from './actions';

export const metadata = { title: 'Discounts' };

export default async function DiscountsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('discounts');
  const sp = await searchParams;
  const [codes, s, referralOrders] = await Promise.all([
    db.discountCode.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] }),
    getSettings(),
    db.order.count({ where: { referrerId: { not: null }, status: { not: 'cancelled' } } }),
  ]);
  const now = new Date();
  return (
    <>
      <PageHead
        title="Discounts"
        sub="Codes customers type at checkout. Referral codes (MT-…) belong to customers and are set up under Settings › Referral."
        actions={
          <Link className="a-btn copper" href="/admin/discounts/new">
            New code
          </Link>
        }
      />
      <Flash sp={sp} />
      {codes.length === 0 ? (
        <Empty title="No discount codes" action={<Link className="a-btn" href="/admin/discounts/new">Create one</Link>} />
      ) : (
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Rules</th>
                <th>Dates</th>
                <th className="num">Used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {codes.map((d) => {
                const expired = d.endsAt && d.endsAt < now;
                const future = d.startsAt && d.startsAt > now;
                const full = d.maxUses != null && d.usedCount >= d.maxUses;
                return (
                  <tr key={d.id}>
                    <td>
                      <Link className="a-rowlink a-mono" href={`/admin/discounts/${d.id}`}>
                        {d.code}
                      </Link>
                      {d.description && <span className="a-small">{d.description}</span>}
                      {d.code === s.marketing.welcomeCode && <span className="a-small">Sign-up pop-up code</span>}
                    </td>
                    <td>{d.kind === 'percent' ? `${d.value}% off` : `${m2(d.value)} off`}</td>
                    <td className="a-small" style={{ color: 'var(--ink)' }}>
                      {[d.firstOrderOnly && 'First order only', d.minSubtotal > 0 && `Spend ${money(d.minSubtotal)}+`].filter(Boolean).join(' · ') || 'Anyone'}
                    </td>
                    <td className="a-small" style={{ color: 'var(--ink)' }}>
                      {d.startsAt || d.endsAt ? `${d.startsAt ? fd(d.startsAt) : 'Now'} to ${d.endsAt ? fd(d.endsAt) : 'no end'}` : 'No end date'}
                    </td>
                    <td className="num">
                      {d.usedCount}
                      {d.maxUses != null ? ` / ${d.maxUses}` : ''}
                    </td>
                    <td>
                      {!d.active ? <Pill>Off</Pill> : expired ? <Pill tone="red">Expired</Pill> : future ? <Pill tone="amber">Scheduled</Pill> : full ? <Pill tone="red">Used up</Pill> : <Pill tone="green">Active</Pill>}
                    </td>
                    <td className="a-right">
                      <form action={toggleDiscountAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <SubmitButton className="a-btn ghost sm">{d.active ? 'Switch off' : 'Switch on'}</SubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="a-small" style={{ marginTop: 14 }}>
        Referral codes have been used on {referralOrders} {referralOrders === 1 ? 'order' : 'orders'}. Friends get {s.referral.discountPct}% off and the referrer gets {m2(s.referral.creditPence)} of credit
        when the order ships{s.referral.enabled ? '' : ' (referrals are switched off)'}.
      </p>
    </>
  );
}
