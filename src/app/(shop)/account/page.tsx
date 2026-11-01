import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getCustomer } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { m2, money } from '@/lib/money';
import { AccountShell } from './shell';
import { OrderCard } from './order-card';
import { SignInForms } from './forms';

export const metadata: Metadata = { title: 'My account', robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string; link?: string; signedout?: string; welcome?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const sp = await searchParams;
  const c = await getCustomer();
  if (!c) {
    return (
      <div className="k-page">
        <div className="k-wrap" style={{ maxWidth: 1000 }}>
          <nav className="k-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span>Sign in</span>
          </nav>
          <h1 className="k-h1">Sign in or create an account</h1>
          <p className="k-lede">Track orders, reorder in one tap and get alerts when something you like is back in stock.</p>
          {sp.link === 'expired' && <div className="k-flash bad" style={{ marginTop: 18 }}>That sign in link has expired or was already used. Ask for a new one below.</div>}
          {sp.signedout && <div className="k-flash good" style={{ marginTop: 18 }}>You are signed out.</div>}
          <SignInForms next={sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/account'} />
        </div>
      </div>
    );
  }

  const [orders, alerts, s] = await Promise.all([
    db.order.findMany({ where: { customerId: c.id }, orderBy: { createdAt: 'desc' }, include: { items: true } }),
    db.productAlert.count({ where: { email: c.email } }),
    getSettings(),
  ]);
  const spent = orders.filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded').reduce((t, o) => t + o.total - o.refundedAmount, 0);
  const last = orders[0];
  return (
    <AccountShell current="/account">
      {sp.welcome && <div className="k-flash good">Your password is set and you are signed in.</div>}
      <h2 className="k-h2" style={{ marginBottom: 16 }}>
        Welcome back{c.name ? `, ${c.name.split(' ')[0]}` : ''}
      </h2>
      <div className="k-stats">
        <div>
          <b>{orders.length}</b>
          <span>Orders</span>
        </div>
        <div>
          <b>{m2(spent)}</b>
          <span>Total spent</span>
        </div>
        <div>
          <b>{c.creditPence ? m2(c.creditPence) : alerts}</b>
          <span>{c.creditPence ? 'Store credit' : 'Active alerts'}</span>
        </div>
      </div>
      <h3 className="k-h3" style={{ margin: '28px 0 12px' }}>
        Latest order
      </h3>
      {last ? (
        <OrderCard o={last} />
      ) : (
        <div className="k-empty">
          <p style={{ margin: 0 }}>No orders yet.</p>
          <Link className="k-btn" href="/shop">
            Browse the range
          </Link>
        </div>
      )}
      <div className="k-grid2" style={{ marginTop: 20 }}>
        <Link className="k-card" href="/account/alerts" style={{ textDecoration: 'none', color: 'inherit' }}>
          <b className="k-h3">Restock alerts</b>
          <p className="k-small" style={{ margin: '6px 0 0' }}>
            Choose what you hear about, product by product.
          </p>
        </Link>
        {s.referral.enabled && (
          <Link className="k-card" href="/account/refer" style={{ textDecoration: 'none', color: 'inherit' }}>
            <b className="k-h3">Refer a friend</b>
            <p className="k-small" style={{ margin: '6px 0 0' }}>
              Friends get {s.referral.discountPct}% off their first order and you get {money(s.referral.creditPence)} credit when it ships.
            </p>
          </Link>
        )}
      </div>
    </AccountShell>
  );
}
