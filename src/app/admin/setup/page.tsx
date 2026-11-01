import type { Metadata } from 'next';
import Link from 'next/link';
import { peekAdminToken } from '@/lib/auth';
import { SetupForm } from './form';

export const metadata: Metadata = { title: 'Choose your password', referrer: 'no-referrer' };

// Opened from the one-time link that `npm run admin:create -- --link` prints on the server.
export default async function AdminSetup({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? '';
  const t = await peekAdminToken(token);
  return (
    <main className="a-login">
      <div className="a-login-card">
        <div className="top">
          <span className="a-brand">
            MT2 LAB<small>UK</small>
            <em>Admin</em>
          </span>
        </div>
        <div className="a-tones" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="body">
          {t ? (
            <>
              <h1>{t.kind === 'setup' ? `Welcome, ${t.admin.name.split(' ')[0]}` : 'New password'}</h1>
              <p className="a-small" style={{ margin: '0 0 18px' }}>
                Choose the password for <b>{t.admin.email}</b>. {t.kind === 'recover' ? 'Two-step sign in has been reset, so set it up again afterwards.' : 'You are signed in straight after.'}
              </p>
              <SetupForm token={token} email={t.admin.email} />
            </>
          ) : (
            <>
              <h1>Link expired</h1>
              <p className="a-small" style={{ margin: '0 0 18px' }}>
                This link has been used or is more than a day old. Make a new one on the server with <span className="a-code">npm run admin:create -- --link you@example.com</span>.
              </p>
              <Link href="/admin/login" className="a-btn copper block" style={{ minHeight: 46 }}>
                Go to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
