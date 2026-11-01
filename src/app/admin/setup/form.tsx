'use client';

import { useActionState } from 'react';
import { setAdminPassword, type SetupState } from './actions';

export function SetupForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<SetupState, FormData>(setAdminPassword, {});
  return (
    <form action={action} className="a-form" noValidate>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="username" autoComplete="username" value={email} readOnly />
      {state.error && (
        <div className="a-flash err" role="alert" style={{ marginBottom: 0 }}>
          <span>{state.error}</span>
        </div>
      )}
      <div className="a-field">
        <label htmlFor="sp">New password</label>
        <input id="sp" name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus aria-describedby="sp-hint" />
        <span className="hint" id="sp-hint">
          At least 10 characters. A password manager can make a strong one.
        </span>
      </div>
      <div className="a-field">
        <label htmlFor="sc">Type it again</label>
        <input id="sc" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <button className="a-btn copper block" disabled={pending} style={{ minHeight: 46 }}>
        {pending ? 'Saving…' : 'Save and sign in'}
      </button>
    </form>
  );
}
