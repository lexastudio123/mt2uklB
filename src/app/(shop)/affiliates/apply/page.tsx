import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSettings } from '@/lib/settings';
import { getAffiliate } from '@/lib/affiliate-auth';
import { KitCrumbs } from '@/components/shop/trust';
import { ApplyForm } from '../forms';

export const metadata: Metadata = {
  title: 'Apply to the affiliate programme',
  description: 'Apply to share MT2 Lab with your research audience and earn commission on every order placed with your code.',
  alternates: { canonical: '/affiliates/apply' },
};

export default async function ApplyPage() {
  const [s, me] = await Promise.all([getSettings(), getAffiliate()]);
  if (me) redirect('/affiliates/portal');
  const open = s.affiliates.enabled && s.affiliates.applicationsOpen;
  return (
    <div className="k-page">
      <div className="k-wrap k-narrow">
        <KitCrumbs items={[['Affiliate programme', '/affiliates'], ['Apply']]} />
        <h1 className="k-h1">Apply to join</h1>
        {open ? (
          <>
            <p className="k-lede">
              Tell us about your audience. We review every application by hand and reply by email, usually within a few working days. Already an affiliate?{' '}
              <Link className="k-link" href="/affiliates/login">
                Sign in
              </Link>
              .
            </p>
            <div style={{ marginTop: 26 }}>
              <ApplyForm rulesHref="/affiliates/terms" />
            </div>
          </>
        ) : (
          <p className="k-lede">We are not taking new applications at the moment. Check back soon.</p>
        )}
      </div>
    </div>
  );
}
