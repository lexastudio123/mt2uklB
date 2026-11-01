'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/admin/client';
import { removeEmailConnectionAction, saveEmailConnectionAction, type EmailFormState } from './actions';

type Saved = { host: string; port: number; user: string; from: string; hasPassword: boolean };

/** SMTP details. Keeps what was typed when the connection test fails, apart from the password. */
export function EmailConnectionForm({ saved, storeName, supportEmail }: { saved: Saved | null; storeName: string; supportEmail: string }) {
  const [state, action] = useActionState<EmailFormState, FormData>(saveEmailConnectionAction, {});
  const v = state.values ?? { host: saved?.host ?? '', port: String(saved?.port ?? 587), user: saved?.user ?? '', from: saved?.from ?? '' };
  return (
    <form action={action} className="a-form" autoComplete="off">
      {state.err && (
        <div className="a-flash err" role="alert" style={{ marginBottom: 0 }}>
          <span>{state.err}</span>
        </div>
      )}
      <div className="a-row2">
        <div className="a-field mono">
          <label htmlFor="smtpHost">SMTP server</label>
          <input id="smtpHost" name="smtpHost" defaultValue={v.host} placeholder="smtp.example.com" maxLength={200} autoCapitalize="off" spellCheck={false} />
        </div>
        <div className="a-field mono">
          <label htmlFor="smtpPort">Port</label>
          <input id="smtpPort" name="smtpPort" type="number" min={1} max={65535} defaultValue={v.port} />
          <span className="hint">587 for most providers. 465 if yours says SSL.</span>
        </div>
      </div>
      <div className="a-row2">
        <div className="a-field mono">
          <label htmlFor="smtpUser">Username</label>
          <input id="smtpUser" name="smtpUser" defaultValue={v.user} maxLength={200} autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </div>
        <div className="a-field mono">
          <label htmlFor="smtpPass">Password</label>
          <input id="smtpPass" name="smtpPass" type="password" autoComplete="new-password" placeholder={saved?.hasPassword ? 'Saved. Leave blank to keep it' : ''} />
          <span className="hint">Often an &ldquo;SMTP key&rdquo; or app password, not your normal sign in.</span>
        </div>
      </div>
      <div className="a-field">
        <label htmlFor="mailFrom">
          From <span className="opt">(optional)</span>
        </label>
        <input id="mailFrom" name="mailFrom" defaultValue={v.from} placeholder={`${storeName} <orders@yourdomain.co.uk>`} maxLength={200} />
        <span className="hint">
          An address at your own domain, with your provider&apos;s SPF and DKIM records added to the domain so emails are not marked as spam. Replies go to {supportEmail}.
        </span>
      </div>
      <div className="a-formfoot">
        <SubmitButton className="a-btn copper" pending="Connecting…">
          Save and send a test email
        </SubmitButton>
        {saved && (
          <SubmitButton className="a-btn ghost" formAction={removeEmailConnectionAction} confirm="Remove the email details? Emails will be recorded but not sent.">
            Remove
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
