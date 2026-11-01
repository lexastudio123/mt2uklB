import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCustomer } from '@/lib/auth';
import { signOut } from './actions';

export const ACCOUNT_NAV: [string, string][] = [
  ['/account', 'Overview'],
  ['/account/orders', 'Orders'],
  ['/account/alerts', 'Alerts'],
  ['/account/addresses', 'Addresses'],
  ['/account/details', 'Account details'],
  ['/account/refer', 'Refer a friend'],
];

/** Signed-in customer or a redirect to the sign in page (remembering where they were going). */
export async function requireCustomer(path: string) {
  const c = await getCustomer();
  if (!c) redirect(`/account?next=${encodeURIComponent(path)}`);
  return c;
}

export function AccountShell({ current, crumb, children }: { current: string; crumb?: string; children: React.ReactNode }) {
  const label = crumb ?? ACCOUNT_NAV.find(([h]) => h === current)?.[1];
  return (
    <div className="k-page">
      <div className="k-wrap">
        <nav className="k-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          {current === '/account' && !crumb ? (
            <span>My account</span>
          ) : (
            <>
              <Link href="/account">My account</Link>
              <span aria-hidden="true">/</span>
              <span>{label}</span>
            </>
          )}
        </nav>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <h1 className="k-h1" style={{ fontSize: 'clamp(28px,3.4vw,42px)' }}>
            My account
          </h1>
        </div>
        <div className="k-acct">
          <nav className="k-anav" aria-label="Account">
            {ACCOUNT_NAV.map(([href, l]) => (
              <Link key={href} href={href} aria-current={href === current ? 'page' : undefined}>
                {l}
              </Link>
            ))}
            <form action={signOut} style={{ display: 'contents' }}>
              <button>Sign out</button>
            </form>
          </nav>
          <div style={{ minWidth: 0 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
