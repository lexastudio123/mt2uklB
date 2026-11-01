import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { ago, fdt } from '@/lib/admin/format';
import { Flash, PageHead, Pill } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import { changeMyPasswordAction, signOutEverywhereAction, updateMyNameAction } from './actions';

export const metadata = { title: 'Your account' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireAdmin('staff');
  const sp = await searchParams;
  const sessions = await db.adminSession.findMany({ where: { adminId: a.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  return (
    <>
      <PageHead title="Your account" after={<Pill tone="copper">{ROLE_LABEL[a.role] ?? a.role}</Pill>} sub={`${a.email} · last signed in ${fdt(a.lastLoginAt)}`} />
      <Flash sp={sp} />
      <div className="a-grid c2">
        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">Name</h2>
            <form action={updateMyNameAction} className="a-inline">
              <div className="a-field">
                <label htmlFor="n">Shown on notes and replies</label>
                <input id="n" name="name" defaultValue={a.name} maxLength={80} required />
              </div>
              <SubmitButton className="a-btn ghost">Save</SubmitButton>
            </form>
          </div>
          <div className="a-card">
            <h2 className="a-h2">Signed in on</h2>
            {sessions.map((s) => (
              <div key={s.id} className="a-kv" style={{ flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13.5 }}>{s.userAgent?.replace(/\(([^)]*)\).*/, '($1)').slice(0, 90) || 'Unknown browser'}</span>
                <span className="a-small">
                  Signed in {ago(s.createdAt)} · {s.ip}
                </span>
              </div>
            ))}
            {sessions.length > 1 && (
              <form action={signOutEverywhereAction} style={{ marginTop: 12 }}>
                <SubmitButton className="a-btn ghost sm" confirm="Sign out of every other device?">
                  Sign out other devices
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
        <div className="a-card">
          <h2 className="a-h2">Change password</h2>
          <form action={changeMyPasswordAction} className="a-form">
            <input type="hidden" name="username" autoComplete="username" value={a.email} readOnly />
            <div className="a-field">
              <label htmlFor="cur">Current password</label>
              <input id="cur" name="current" type="password" autoComplete="current-password" required />
            </div>
            <div className="a-field">
              <label htmlFor="np">New password</label>
              <input id="np" name="next" type="password" autoComplete="new-password" minLength={10} required />
              <span className="hint">At least 10 characters. A short sentence works well.</span>
            </div>
            <div className="a-field">
              <label htmlFor="cp">New password again</label>
              <input id="cp" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
            </div>
            <SubmitButton className="a-btn copper">Change password</SubmitButton>
          </form>
        </div>
      </div>
    </>
  );
}
