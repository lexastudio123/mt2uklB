'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { CopyButton } from '@/components/shop/bits';
import {
  affiliateForgot,
  affiliateSetPassword,
  affiliateSignIn,
  applyAction,
  changeAffiliatePassword,
  saveAffiliateBank,
  saveAffiliateProfile,
  type FormState,
} from './actions';

function Field({
  id,
  name,
  label,
  type = 'text',
  auto,
  value,
  error,
  opt,
  hint,
  full,
  max,
  mono,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  auto?: string;
  value?: string | null;
  error?: string;
  opt?: boolean;
  hint?: string;
  full?: boolean;
  max?: number;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={`k-field${error ? ' bad' : ''}${full ? ' full' : ''}`}>
      <label htmlFor={id}>
        {label}
        {opt && <span className="opt"> (optional)</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={auto}
        defaultValue={value ?? ''}
        maxLength={max}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        style={mono ? { fontFamily: 'var(--mono)', letterSpacing: '.04em' } : undefined}
        {...(type === 'email' ? { inputMode: 'email' as const } : {})}
      />
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <span className="err" id={`${id}-err`}>
        {error}
      </span>
    </div>
  );
}

function Password({ id, name, label, auto, hint, error }: { id: string; name: string; label: string; auto: string; hint?: string; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`k-field${error ? ' bad' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="k-pw">
        <input id={id} name={name} type={show ? 'text' : 'password'} autoComplete={auto} aria-invalid={error ? true : undefined} />
        <button type="button" onClick={() => setShow((v) => !v)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <span className="hint">{hint}</span>}
      <span className="err">{error}</span>
    </div>
  );
}

const Said = ({ s }: { s: FormState }) =>
  s.error || s.message ? (
    <p className="k-small" style={{ margin: 0, color: s.error ? 'var(--k-bad)' : 'var(--k-good)' }} role={s.error ? 'alert' : 'status'}>
      {s.error || s.message}
    </p>
  ) : null;

// ───────── Public ─────────

export function ApplyForm({ rulesHref }: { rulesHref: string }) {
  const [st, action, pending] = useActionState<FormState, FormData>(applyAction, {});
  if (st.ok) {
    return (
      <div className="k-card" role="status">
        <h2 className="k-h2" style={{ fontSize: 22, marginBottom: 8 }}>
          Application sent
        </h2>
        <p className="k-mute" style={{ margin: 0, lineHeight: 1.65 }}>
          {st.message}
        </p>
      </div>
    );
  }
  const v = st.values ?? {};
  const e = st.errors ?? {};
  return (
    <form action={action} className="k-form" noValidate>
      <Field id="ap-name" name="name" label="Your name" auto="name" value={v.name} error={e.name} max={120} />
      <Field id="ap-email" name="email" label="Email" type="email" auto="email" value={v.email} error={e.email} max={200} />
      <Field id="ap-web" name="website" label="Website or main profile" auto="url" value={v.website} error={e.website} max={300} placeholder="https://" full />
      <div className="k-field full">
        <label htmlFor="ap-soc">
          Other channels <span className="opt">(optional)</span>
        </label>
        <textarea id="ap-soc" name="socials" defaultValue={v.socials} maxLength={1000} style={{ minHeight: 80 }} placeholder="Other social accounts, newsletters or communities, with rough audience sizes" />
      </div>
      <div className={`k-field full${e.pitch ? ' bad' : ''}`}>
        <label htmlFor="ap-pitch">Who is your audience, and how would you share us?</label>
        <textarea id="ap-pitch" name="pitch" defaultValue={v.pitch} maxLength={2000} aria-invalid={e.pitch ? true : undefined} />
        <span className="err">{e.pitch}</span>
      </div>
      <Field id="ap-code" name="code" label="Code you would like" value={v.code} max={20} opt mono hint="Letters and numbers, for example SARAH10. We confirm it when we approve you." />
      <div className="k-field" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="ap-cs">Leave this empty</label>
        <input id="ap-cs" name="company_site" tabIndex={-1} autoComplete="off" />
      </div>
      <div className={`full${e.agree ? ' k-field bad' : ''}`}>
        <label className="k-check">
          <input type="checkbox" name="agree" />
          <span>
            I have read and agree to the{' '}
            <Link className="k-link" href={rulesHref} target="_blank">
              programme rules
            </Link>
            , including that I will only present the products as laboratory research materials, never for use in people.
          </span>
        </label>
        {e.agree && (
          <p className="k-small" style={{ margin: '6px 0 0', color: 'var(--k-bad)' }}>
            {e.agree}
          </p>
        )}
      </div>
      <div className="full" style={{ display: 'grid', gap: 10 }}>
        <Said s={st} />
        <button className="k-btn" disabled={pending} style={{ justifySelf: 'start' }}>
          {pending ? 'Sending…' : 'Send application'}
        </button>
      </div>
    </form>
  );
}

export function AffiliateSignIn({ next }: { next: string }) {
  const [inState, inAction, inPending] = useActionState<FormState, FormData>(affiliateSignIn, {});
  const [fState, fAction, fPending] = useActionState<FormState, FormData>(affiliateForgot, {});
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  return (
    <div className="k-card">
      {!forgot ? (
        <>
          <form action={inAction} className="k-form" style={{ gridTemplateColumns: 'minmax(0,1fr)' }} noValidate>
            <input type="hidden" name="next" value={next} />
            <div className={`k-field${inState.errors?.email ? ' bad' : ''}`}>
              <label htmlFor="as-e">Email</label>
              <input id="as-e" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <span className="err">{inState.errors?.email}</span>
            </div>
            <Password id="as-p" name="password" label="Password" auto="current-password" error={inState.errors?.password} />
            <Said s={inState} />
            <button className="k-btn block" disabled={inPending}>
              {inPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <button type="button" className="k-link" style={{ fontSize: 14, marginTop: 14, minHeight: 28 }} onClick={() => setForgot(true)}>
            Forgot your password?
          </button>
        </>
      ) : (
        <>
          <p className="k-mute" style={{ margin: '0 0 14px', fontSize: 14.5 }}>
            Enter the email you applied with and we will send a link to choose a new password.
          </p>
          {fState.ok ? (
            <Said s={fState} />
          ) : (
            <form action={fAction} className="k-form" style={{ gridTemplateColumns: 'minmax(0,1fr)' }} noValidate>
              <div className={`k-field${fState.errors?.email ? ' bad' : ''}`}>
                <label htmlFor="af-e">Email</label>
                <input id="af-e" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={email} />
                <span className="err">{fState.errors?.email}</span>
              </div>
              <Said s={fState} />
              <button className="k-btn block" disabled={fPending}>
                {fPending ? 'Sending…' : 'Email me a link'}
              </button>
            </form>
          )}
          <button type="button" className="k-link" style={{ fontSize: 14, marginTop: 14, minHeight: 28 }} onClick={() => setForgot(false)}>
            Back to sign in
          </button>
        </>
      )}
    </div>
  );
}

export function SetPasswordForm({ token, first }: { token: string; first: boolean }) {
  const [st, action, pending] = useActionState<FormState, FormData>(affiliateSetPassword, {});
  return (
    <form action={action} className="k-card k-form" style={{ gridTemplateColumns: 'minmax(0,1fr)' }} noValidate>
      <input type="hidden" name="token" value={token} />
      <Password id="sp-p" name="password" label={first ? 'Choose a password' : 'New password'} auto="new-password" hint="At least 8 characters. A short phrase is easy to remember." error={st.errors?.password} />
      <Said s={st} />
      <button className="k-btn block" disabled={pending}>
        {pending ? 'Saving…' : first ? 'Set password and open the portal' : 'Save and sign in'}
      </button>
    </form>
  );
}

// ───────── Portal ─────────

/** Builds a link to any page with the affiliate's code attached. */
export function LinkBuilder({ base, code, pages }: { base: string; code: string; pages: [string, string][] }) {
  const [to, setTo] = useState('/');
  const url = `${base}/r/${code}${to === '/' ? '' : `?to=${encodeURIComponent(to)}`}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 10 }}>
      <div className="k-field">
        <label htmlFor="lb-page">Link to</label>
        <select id="lb-page" value={to} onChange={(e) => setTo(e.target.value)}>
          {pages.map(([href, label]) => (
            <option key={href} value={href}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="k-copy" style={{ fontWeight: 600, letterSpacing: 0, fontSize: 14 }}>
        <span>{url}</span>
        <CopyButton text={url} label="Copy link" />
      </div>
    </div>
  );
}

type Profile = {
  name: string;
  phone: string | null;
  company: string | null;
  website: string | null;
  socials: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  taxRef: string | null;
  notifySales: boolean;
};

export function ProfileForm({ a, email }: { a: Profile; email: string }) {
  const [st, action, pending] = useActionState<FormState, FormData>(saveAffiliateProfile, {});
  return (
    <form action={action} className="k-form" noValidate>
      <Field id="pf-name" name="name" label="Name" auto="name" value={a.name} error={st.errors?.name} max={120} />
      <div className="k-field">
        <span className="k-lab">Email</span>
        <p style={{ margin: 0, minHeight: 50, display: 'flex', alignItems: 'center', fontSize: 15 }}>{email}</p>
        <span className="hint">To change it, contact us.</span>
      </div>
      <Field id="pf-phone" name="phone" label="Phone" type="tel" auto="tel" value={a.phone} max={40} opt />
      <Field id="pf-company" name="company" label="Company or trading name" auto="organization" value={a.company} max={120} opt />
      <Field id="pf-web" name="website" label="Website or main profile" auto="url" value={a.website} max={300} opt />
      <Field id="pf-tax" name="taxRef" label="Tax reference" value={a.taxRef} max={40} opt hint="UTR or VAT number, if you have one." />
      <div className="k-field full">
        <label htmlFor="pf-soc">
          Other channels <span className="opt">(optional)</span>
        </label>
        <textarea id="pf-soc" name="socials" defaultValue={a.socials ?? ''} maxLength={1000} style={{ minHeight: 80 }} />
      </div>
      <Field id="pf-a1" name="addressLine1" label="Address line 1" auto="address-line1" value={a.addressLine1} max={150} opt />
      <Field id="pf-a2" name="addressLine2" label="Address line 2" auto="address-line2" value={a.addressLine2} max={150} opt />
      <Field id="pf-city" name="city" label="Town or city" auto="address-level2" value={a.city} max={80} opt />
      <Field id="pf-post" name="postcode" label="Postcode" auto="postal-code" value={a.postcode} max={12} opt />
      <Field id="pf-country" name="country" label="Country" auto="country-name" value={a.country} max={60} />
      <label className="k-check full">
        <input type="checkbox" name="notifySales" defaultChecked={a.notifySales} />
        <span>Email me for each sale</span>
      </label>
      <div className="full" style={{ display: 'grid', gap: 10 }}>
        <Said s={st} />
        <button className="k-btn" disabled={pending} style={{ justifySelf: 'start' }}>
          {pending ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  );
}

export function BankForm({ masked }: { masked: string | null }) {
  const [st, action, pending] = useActionState<FormState, FormData>(saveAffiliateBank, {});
  const [open, setOpen] = useState(!masked);
  // Close the form once saved; the page passes in the new masked details.
  useEffect(() => {
    if (st.ok) setOpen(false);
  }, [st]);
  const v = st.values ?? {};
  const e = st.errors ?? {};
  if (!open && masked) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {st.ok && <Said s={st} />}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <p style={{ margin: 0, flex: 1, minWidth: 200 }}>{masked}</p>
          <button type="button" className="k-btn sm ghost" onClick={() => setOpen(true)}>
            Change bank details
          </button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="k-form" noValidate>
      <Field id="bk-name" name="accountName" label="Name on the account" value={v.accountName} error={e.accountName} max={120} full />
      <Field id="bk-sort" name="sortCode" label="Sort code" value={v.sortCode} error={e.sortCode} max={8} mono placeholder="12-34-56" />
      <Field id="bk-acc" name="accountNumber" label="Account number" value={v.accountNumber} error={e.accountNumber} max={10} mono />
      <Field id="bk-iban" name="iban" label="IBAN" value={v.iban} error={e.iban} max={40} mono opt hint="Only for accounts outside the UK." />
      <Field id="bk-bic" name="bic" label="BIC (SWIFT)" value={v.bic} error={e.bic} max={11} mono opt />
      <div className="full">
        <Password id="bk-pw" name="password" label="Your password, to confirm" auto="current-password" error={e.password} />
      </div>
      <p className="k-small full" style={{ margin: 0 }}>
        We email you whenever these change, and payouts go only to the account here.
      </p>
      <div className="full" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="k-btn" disabled={pending}>
          {pending ? 'Saving…' : 'Save bank details'}
        </button>
        {masked && (
          <button type="button" className="k-link" onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
        <Said s={st} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [st, action, pending] = useActionState<FormState, FormData>(changeAffiliatePassword, {});
  return (
    <form action={action} className="k-form" noValidate>
      <Password id="pw-cur" name="current" label="Current password" auto="current-password" error={st.errors?.current} />
      <Password id="pw-new" name="password" label="New password" auto="new-password" error={st.errors?.password} />
      <div className="full" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="k-btn ghost" disabled={pending}>
          {pending ? 'Saving…' : 'Change password'}
        </button>
        <Said s={st} />
      </div>
    </form>
  );
}
