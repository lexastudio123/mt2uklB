import Link from 'next/link';
import { affiliateSignOut } from '../actions';

const NAV: [string, string][] = [
  ['/affiliates/portal', 'Overview'],
  ['/affiliates/portal/sales', 'Sales'],
  ['/affiliates/portal/payouts', 'Payouts'],
  ['/affiliates/portal/details', 'Your details'],
];

export function PortalShell({ current, children }: { current: string; children: React.ReactNode }) {
  const label = NAV.find(([h]) => h === current)?.[1];
  return (
    <div className="k-page">
      <div className="k-wrap">
        <nav className="k-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/affiliates">Affiliate programme</Link>
          <span aria-hidden="true">/</span>
          {current === '/affiliates/portal' ? (
            <span>Portal</span>
          ) : (
            <>
              <Link href="/affiliates/portal">Portal</Link>
              <span aria-hidden="true">/</span>
              <span>{label}</span>
            </>
          )}
        </nav>
        <h1 className="k-h1" style={{ fontSize: 'clamp(28px,3.4vw,42px)', marginBottom: 24 }}>
          Affiliate portal
        </h1>
        <div className="k-acct">
          <nav className="k-anav" aria-label="Affiliate portal">
            {NAV.map(([href, l]) => (
              <Link key={href} href={href} aria-current={href === current ? 'page' : undefined}>
                {l}
              </Link>
            ))}
            <form action={affiliateSignOut} style={{ display: 'contents' }}>
              <button>Sign out</button>
            </form>
          </nav>
          <div style={{ minWidth: 0 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/** How a commission row reads to the affiliate. */
export function saleStatus(c: { status: string; amount: number; voidReason: string | null; paidAt: Date | null }, clears: Date | null): string {
  const d = (x: Date) => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
  if (c.status === 'pending') return clears ? `Pending until ${d(clears)}` : 'Pending until dispatch';
  if (c.status === 'approved') return c.amount < 0 ? 'Comes off your next payout' : 'Ready to pay';
  if (c.status === 'paid') return c.paidAt ? `${c.amount < 0 ? 'Deducted' : 'Paid'} ${d(c.paidAt)}` : 'Paid';
  return c.voidReason ? `Cancelled: ${c.voidReason.charAt(0).toLowerCase()}${c.voidReason.slice(1)}` : 'Cancelled';
}
