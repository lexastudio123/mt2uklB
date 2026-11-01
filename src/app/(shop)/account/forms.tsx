'use client';

import { useActionState, useState, useTransition } from 'react';
import { useCart, useShop, useUI } from '@/components/shop/providers';
import { addAddress, changePassword, resetPassword, sendLink, setAlert, signIn, signUp, updateDetails, type FormState } from './actions';

function Password({ id, name, label, auto, hint, error }: { id: string; name: string; label: string; auto: string; hint?: string; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`k-field${error ? ' bad' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="k-pw">
        <input id={id} name={name} type={show ? 'text' : 'password'} autoComplete={auto} />
        <button type="button" onClick={() => setShow((v) => !v)}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <span className="hint">{hint}</span>}
      <span className="err">{error}</span>
    </div>
  );
}

function Field({ id, name, label, type = 'text', auto, value, error, opt }: { id: string; name: string; label: string; type?: string; auto?: string; value?: string; error?: string; opt?: boolean }) {
  return (
    <div className={`k-field${error ? ' bad' : ''}`}>
      <label htmlFor={id}>
        {label}
        {opt && <span className="opt"> (optional)</span>}
      </label>
      <input id={id} name={name} type={type} autoComplete={auto} defaultValue={value} {...(type === 'email' ? { inputMode: 'email' as const } : {})} />
      <span className="err">{error}</span>
    </div>
  );
}

export function SignInForms({ next }: { next: string }) {
  const [inState, inAction, inPending] = useActionState<FormState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<FormState, FormData>(signUp, {});
  const [linkState, linkAction, linkPending] = useActionState<FormState, FormData>(sendLink, {});
  const [email, setEmail] = useState('');
  return (
    <div className="k-grid2" style={{ marginTop: 26, alignItems: 'start' }}>
      <div className="k-card">
        <h2 className="k-h2" style={{ fontSize: 21, marginBottom: 14 }}>
          Sign in
        </h2>
        <form action={inAction} className="k-form" style={{ gridTemplateColumns: 'minmax(0,1fr)' }} noValidate>
          <input type="hidden" name="next" value={next} />
          <div className={`k-field${inState.errors?.email || linkState.errors?.email ? ' bad' : ''}`}>
            <label htmlFor="ki-e">Email</label>
            <input id="ki-e" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <span className="err">{inState.errors?.email || linkState.errors?.email}</span>
          </div>
          <Password id="ki-p" name="password" label="Password" auto="current-password" error={inState.errors?.password} />
          {inState.error && (
            <p className="k-small" style={{ margin: 0, color: 'var(--k-bad)' }} role="alert">
              {inState.error}
            </p>
          )}
          <button className="k-btn block" disabled={inPending}>
            {inPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <form action={linkAction} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
          <input type="hidden" name="email" value={email} />
          <button className="k-link" name="kind" value="reset" style={{ fontSize: 14, minHeight: 28 }} disabled={linkPending}>
            Forgot password?
          </button>
          <button className="k-link" name="kind" value="magic" style={{ fontSize: 14, minHeight: 28 }} disabled={linkPending}>
            Email me a sign in link instead
          </button>
        </form>
        {(linkState.message || linkState.error) && (
          <p className="k-small" style={{ margin: '10px 0 0', color: linkState.error ? 'var(--k-bad)' : 'var(--k-good)' }} aria-live="polite">
            {linkState.message || linkState.error}
          </p>
        )}
      </div>
      <div className="k-card">
        <h2 className="k-h2" style={{ fontSize: 21, marginBottom: 6 }}>
          New here?
        </h2>
        <ul style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--k-mute)', fontSize: 14.5, lineHeight: 1.8 }}>
          <li>Reorder past orders in one tap</li>
          <li>Live order tracking</li>
          <li>Restock and new batch alerts</li>
          <li>Saved delivery addresses</li>
        </ul>
        {upState.ok ? (
          <p className="k-small" style={{ color: 'var(--k-good)', margin: 0 }}>
            {upState.message}
          </p>
        ) : (
          <form action={upAction} className="k-form" style={{ gridTemplateColumns: 'minmax(0,1fr)' }} noValidate>
            <input type="hidden" name="next" value={next} />
            <Field id="ku-n" name="name" label="Full name" auto="name" value={upState.values?.name} error={upState.errors?.name} />
            <Field id="ku-e" name="email" label="Email" type="email" auto="email" value={upState.values?.email} error={upState.errors?.email} />
            <Password id="ku-p" name="password" label="Create a password" auto="new-password" hint="At least 8 characters" error={upState.errors?.password} />
            {upState.error && (
              <p className="k-small" style={{ margin: 0, color: 'var(--k-bad)' }} role="alert">
                {upState.error}
              </p>
            )}
            <button className="k-btn block" disabled={upPending}>
              {upPending ? 'Creating…' : 'Create account'}
            </button>
            <span className="k-small">Prefer not to? You can check out as a guest.</span>
          </form>
        )}
      </div>
    </div>
  );
}

export function ResetForm({ token, claim }: { token: string; claim: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, {});
  return (
    <form action={action} className="k-form k-card" style={{ gridTemplateColumns: 'minmax(0,1fr)', marginTop: 22 }} noValidate>
      <input type="hidden" name="token" value={token} />
      <Password id="rp" name="password" label={claim ? 'Choose a password' : 'New password'} auto="new-password" hint="At least 8 characters" error={state.errors?.password} />
      {state.error && (
        <p className="k-small" style={{ margin: 0, color: 'var(--k-bad)' }} role="alert">
          {state.error}
        </p>
      )}
      <button className="k-btn" disabled={pending}>
        {pending ? 'Saving…' : claim ? 'Finish my account' : 'Save new password'}
      </button>
    </form>
  );
}

export function DetailsForms({ name, email, phone, hasPassword }: { name: string; email: string; phone: string; hasPassword: boolean }) {
  const [d, dAction, dPending] = useActionState<FormState, FormData>(updateDetails, {});
  const [p, pAction, pPending] = useActionState<FormState, FormData>(changePassword, {});
  const [newEmail, setNewEmail] = useState(email);
  return (
    <>
      <form action={dAction} className="k-form" noValidate>
        <Field id="kd-n" name="name" label="Full name" auto="name" value={d.values?.name ?? name} error={d.errors?.name} />
        <div className={`k-field${d.errors?.email ? ' bad' : ''}`}>
          <label htmlFor="kd-e">Email</label>
          <input id="kd-e" name="email" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <span className="err">{d.errors?.email}</span>
        </div>
        <Field id="kd-ph" name="phone" label="Phone" type="tel" auto="tel" value={d.values?.phone ?? phone} error={d.errors?.phone} opt />
        {newEmail.trim().toLowerCase() !== email && hasPassword && <Password id="kd-pw" name="password" label="Current password" auto="current-password" error={d.errors?.password} />}
        <div className="full">
          <button className="k-btn" disabled={dPending}>
            Save changes
          </button>
          {d.ok && (
            <span className="k-small" style={{ marginLeft: 12, color: 'var(--k-good)' }}>
              {d.message}
            </span>
          )}
        </div>
      </form>
      <h3 className="k-h3" style={{ margin: '30px 0 12px' }}>
        {hasPassword ? 'Change password' : 'Set a password'}
      </h3>
      <form action={pAction} className="k-form" noValidate>
        {hasPassword && <Password id="kp-o" name="current" label="Current password" auto="current-password" error={p.errors?.current} />}
        <Password id="kp-n" name="next" label="New password" auto="new-password" hint="At least 8 characters" error={p.errors?.next} />
        <div className="full">
          <button className="k-btn ghost" disabled={pPending}>
            Update password
          </button>
          {p.ok && (
            <span className="k-small" style={{ marginLeft: 12, color: 'var(--k-good)' }}>
              {p.message}
            </span>
          )}
        </div>
      </form>
    </>
  );
}

export function AlertSwitch({ id, title, sub, on }: { id: string; title: string; sub: string; on: boolean }) {
  const [checked, setChecked] = useState(on);
  const [, start] = useTransition();
  const { toast } = useUI();
  return (
    <div className="k-switch">
      <span>
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      <span className="k-toggle">
        <input
          type="checkbox"
          role="switch"
          aria-label={title}
          checked={checked}
          onChange={(e) => {
            const v = e.target.checked;
            setChecked(v);
            start(async () => {
              const r = await setAlert(id, v);
              if (!r.ok) {
                setChecked(!v);
                toast('Could not save that. Try again.');
              } else toast(v ? 'Alert on' : 'Alert off');
            });
          }}
        />
        <i />
      </span>
    </div>
  );
}

export function AddressForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addAddress, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="k-form" noValidate key={state.ok ? Date.now() : 'form'}>
      <Field id="ka-n" name="name" label="Full name" auto="name" value={state.ok ? '' : state.values?.name} error={e.name} />
      <div className={`k-field full${e.line1 ? ' bad' : ''}`}>
        <label htmlFor="ka-1">Address</label>
        <input id="ka-1" name="line1" autoComplete="address-line1" defaultValue={state.ok ? '' : state.values?.line1} />
        <span className="err">{e.line1}</span>
      </div>
      <div className="k-field full">
        <label htmlFor="ka-2">
          Flat, suite or building <span className="opt">(optional)</span>
        </label>
        <input id="ka-2" name="line2" autoComplete="address-line2" defaultValue={state.ok ? '' : state.values?.line2} />
      </div>
      <Field id="ka-c" name="city" label="Town or city" auto="address-level2" value={state.ok ? '' : state.values?.city} error={e.city} />
      <Field id="ka-p" name="postcode" label="Postcode" auto="postal-code" value={state.ok ? '' : state.values?.postcode} error={e.postcode} />
      <div className="full">
        <button className="k-btn" disabled={pending}>
          Save address
        </button>
        {(state.message || state.error) && (
          <span className="k-small" style={{ marginLeft: 12, color: state.error ? 'var(--k-bad)' : 'var(--k-good)' }}>
            {state.message || state.error}
          </span>
        )}
      </div>
    </form>
  );
}

export function ReorderButton({ items, className = 'k-btn sm ghost', label = 'Reorder' }: { items: { packId: string | null; qty: number }[]; className?: string; label?: string }) {
  const { add } = useCart();
  const { catalog } = useShop();
  const { openCart, toast } = useUI();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        let n = 0;
        for (const it of items) {
          if (it.packId && catalog.some((p) => p.packs.some((k) => k.id === it.packId)) && add(it.packId, it.qty, { quiet: true })) n++;
        }
        if (n) {
          toast('Items added to your basket');
          openCart();
        } else toast('These items are no longer available');
      }}
    >
      {label}
    </button>
  );
}
