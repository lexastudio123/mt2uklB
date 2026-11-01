'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAccountFromOrder, type FormState } from './actions';

export function SaveAccountForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAccountFromOrder, {});
  const [show, setShow] = useState(false);
  if (state.sent) return <p className="k-small" style={{ margin: 0, color: 'var(--k-good)' }}>{state.message}</p>;
  return (
    <form action={action} className="k-form" style={{ gridTemplateColumns: 'minmax(0,1fr)' }} noValidate>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} autoComplete="username" />
      <div className={`k-field${state.error ? ' bad' : ''}`}>
        <label htmlFor="kpa-pw">Create a password</label>
        <div className="k-pw">
          <input id="kpa-pw" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} required />
          <button type="button" onClick={() => setShow((v) => !v)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        <span className="hint">At least 8 characters</span>
        <span className="err">{state.error}</span>
      </div>
      <button className="k-btn" disabled={pending}>
        {pending ? 'Creating…' : 'Create my account'}
      </button>
    </form>
  );
}

/** Reload the page while a card payment is being confirmed. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n++;
      router.refresh();
      if (n > 10) clearInterval(t);
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
