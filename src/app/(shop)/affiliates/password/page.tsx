import type { Metadata } from 'next';
import Link from 'next/link';
import { peekAffiliateToken } from '@/lib/affiliate-auth';
import { KitCrumbs } from '@/components/shop/trust';
import { SetPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Choose your password', robots: { index: false }, referrer: 'no-referrer' };

export default async function AffiliatePasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? '';
  const t = await peekAffiliateToken(token);
  const first = t?.kind === 'invite';
  return (
    <div className="k-page">
      <div className="k-wrap" style={{ maxWidth: 520 }}>
        <KitCrumbs items={[['Affiliate programme', '/affiliates'], [first ? 'Choose a password' : 'New password']]} />
        {t ? (
          <>
            <h1 className="k-h1">{first ? `Welcome, ${t.affiliate.name.split(' ')[0]}` : 'Choose a new password'}</h1>
            <p className="k-lede">
              {first ? `Choose a password for the affiliate portal. You sign in with ${t.affiliate.email}.` : `For ${t.affiliate.email}. You will be signed in straight away.`}
            </p>
            <div style={{ marginTop: 22 }}>
              <SetPasswordForm token={token} first={first} />
            </div>
          </>
        ) : (
          <>
            <h1 className="k-h1">This link has expired</h1>
            <p className="k-lede">Links work once and expire after a while. Ask for a new one from the sign in page.</p>
            <p style={{ marginTop: 22 }}>
              <Link className="k-btn" href="/affiliates/login">
                Go to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
