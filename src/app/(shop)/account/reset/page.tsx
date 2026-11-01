import type { Metadata } from 'next';
import Link from 'next/link';
import { peekAuthToken } from '@/lib/auth';
import { ResetForm } from '../forms';

export const metadata: Metadata = { title: 'Choose a password', robots: { index: false, follow: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const t = await peekAuthToken(token, ['reset', 'claim']);
  return (
    <div className="k-page">
      <div className="k-wrap k-narrow">
        <h1 className="k-h1">{t?.kind === 'claim' ? 'Finish your account' : 'Choose a new password'}</h1>
        {t ? (
          <>
            <p className="k-lede">
              {t.kind === 'claim' ? 'Choose a password for ' : 'Set a new password for '}
              <b style={{ color: 'var(--k-ink)' }}>{t.customer.email}</b>. You will be signed in straight away.
            </p>
            <ResetForm token={token} claim={t.kind === 'claim'} />
          </>
        ) : (
          <>
            <p className="k-lede">This link has expired or was already used. Links work once and expire after an hour.</p>
            <Link className="k-btn" href="/account" style={{ marginTop: 20 }}>
              Ask for a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
