import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAffiliate } from '@/lib/affiliate-auth';
import { getSettings } from '@/lib/settings';
import { KitCrumbs } from '@/components/shop/trust';
import { AffiliateSignIn } from '../forms';

export const metadata: Metadata = { title: 'Affiliate sign in', robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string; signedout?: string }> };

export default async function AffiliateLoginPage({ searchParams }: Props) {
  const [sp, me, s] = await Promise.all([searchParams, getAffiliate(), getSettings()]);
  const next = sp.next?.startsWith('/affiliates/portal') ? sp.next : '/affiliates/portal';
  if (me) redirect(next);
  return (
    <div className="k-page">
      <div className="k-wrap" style={{ maxWidth: 520 }}>
        <KitCrumbs items={[['Affiliate programme', '/affiliates'], ['Sign in']]} />
        <h1 className="k-h1">Affiliate sign in</h1>
        <p className="k-lede">See your sales, commission and payouts.</p>
        {sp.signedout && <div className="k-flash good" style={{ marginTop: 18 }}>You are signed out.</div>}
        <div style={{ marginTop: 22 }}>
          <AffiliateSignIn next={next} />
        </div>
        <p className="k-small" style={{ marginTop: 18 }}>
          Shopping with us? <Link className="k-link" href="/account">Customer sign in is here</Link>.
          {s.affiliates.enabled && s.affiliates.applicationsOpen && (
            <>
              {' '}
              Not an affiliate yet? <Link className="k-link" href="/affiliates/apply">Apply to join</Link>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
