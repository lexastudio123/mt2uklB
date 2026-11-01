import type { Metadata } from 'next';
import Link from 'next/link';
import { peekAuthToken } from '@/lib/auth';
import { confirmMagicLink } from '../actions';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

// The button press (not the page load) uses the link, so email scanners that open links cannot sign anyone in.
export default async function MagicPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const t = await peekAuthToken(token, ['magic']);
  return (
    <div className="k-page">
      <div className="k-wrap k-narrow">
        <h1 className="k-h1">Sign in</h1>
        {t ? (
          <>
            <p className="k-lede">
              Continue as <b style={{ color: 'var(--k-ink)' }}>{t.customer.email}</b>.
            </p>
            <form action={confirmMagicLink} style={{ marginTop: 20 }}>
              <input type="hidden" name="token" value={token} />
              <button className="k-btn">Continue to my account</button>
            </form>
          </>
        ) : (
          <>
            <p className="k-lede">This sign in link has expired or was already used.</p>
            <Link className="k-btn" href="/account" style={{ marginTop: 20 }}>
              Ask for a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
