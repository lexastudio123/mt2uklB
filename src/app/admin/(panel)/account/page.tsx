import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { ago, fdt } from '@/lib/admin/format';
import { Flash, PageHead, Pill } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import QRCode from 'qrcode';
import { getSettings } from '@/lib/settings';
import { groupSecret, otpauthUrl } from '@/lib/totp';
import {
  cancelTwoStepSetupAction,
  changeMyPasswordAction,
  confirmTwoStepAction,
  disableTwoStepAction,
  signOutEverywhereAction,
  startTwoStepAction,
  updateMyNameAction,
} from './actions';

async function TwoStep({ a }: { a: { email: string; totpSecret: string | null; totpEnabledAt: Date | null } }) {
  if (a.totpEnabledAt) {
    return (
      <div className="a-card">
        <h2 className="a-h2">
          Two-step sign in <Pill tone="green">On</Pill>
        </h2>
        <p className="a-small" style={{ margin: '0 0 14px' }}>
          Turned on {fdt(a.totpEnabledAt)}. Each sign in asks for the 6-digit code from your authenticator app. Lost your phone? An owner can reset it under Team.
        </p>
        <form action={disableTwoStepAction} className="a-inline">
          <input type="hidden" name="username" autoComplete="username" value={a.email} readOnly />
          <div className="a-field">
            <label htmlFor="d2">Your password, to turn it off</label>
            <input id="d2" name="current" type="password" autoComplete="current-password" required />
          </div>
          <SubmitButton className="a-btn ghost" confirm="Turn off two-step sign in? Your account will only be protected by its password.">
            Turn off
          </SubmitButton>
        </form>
      </div>
    );
  }
  if (a.totpSecret) {
    const s = await getSettings();
    const url = otpauthUrl(a.totpSecret, a.email, s.storeName);
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1A120D', light: '#FFFFFF' } });
    return (
      <div className="a-card">
        <h2 className="a-h2">Set up two-step sign in</h2>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ width: 180, height: 180, flex: 'none', background: '#fff', borderRadius: 6, padding: 6 }} dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code for your authenticator app" />
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <ol className="a-small" style={{ margin: '0 0 14px', paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password or similar).</li>
              <li>Scan the QR code, or add an account by hand with this key:</li>
            </ol>
            <p className="a-code" style={{ display: 'inline-block', fontSize: 15, letterSpacing: '.06em', margin: '0 0 16px', wordBreak: 'break-all' }}>
              {groupSecret(a.totpSecret)}
            </p>
            <form action={confirmTwoStepAction} className="a-inline">
              <div className="a-field">
                <label htmlFor="c2">Then type the 6-digit code it shows</label>
                <input id="c2" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="a-mono" style={{ letterSpacing: '.2em' }} />
              </div>
              <SubmitButton className="a-btn copper">Turn on</SubmitButton>
            </form>
            <form action={cancelTwoStepSetupAction} style={{ marginTop: 10 }}>
              <SubmitButton className="a-btn ghost sm">Cancel setup</SubmitButton>
            </form>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="a-card">
      <h2 className="a-h2">
        Two-step sign in <Pill>Off</Pill>
      </h2>
      <p className="a-small" style={{ margin: '0 0 14px' }}>
        Ask for a code from your phone as well as your password, so a leaked password alone cannot open the admin. Recommended for everyone, essential for owners.
      </p>
      <form action={startTwoStepAction}>
        <SubmitButton className="a-btn copper">Set up two-step sign in</SubmitButton>
      </form>
    </div>
  );
}

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
      <div style={{ marginTop: 16 }}>
        <TwoStep a={a} />
      </div>
    </>
  );
}
