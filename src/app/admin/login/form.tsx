'use client';

import { useActionState } from 'react';
import { adminLogin, adminVerifyCode, cancelAdminLogin, type CodeState, type LoginState } from './actions';

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(adminLogin, {});
  return (
    <form action={action} className="a-form" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <div className="a-flash err" role="alert" style={{ marginBottom: 0 }}>
          <span>{state.error}</span>
        </div>
      )}
      <div className="a-field">
        <label htmlFor="ae">Email</label>
        <input id="ae" name="email" type="email" autoComplete="username" defaultValue={state.email} required autoFocus />
      </div>
      <div className="a-field">
        <label htmlFor="ap">Password</label>
        <input id="ap" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="a-btn copper block" disabled={pending} style={{ minHeight: 46 }}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export function CodeForm({ email, next }: { email: string; next?: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(adminVerifyCode, {});
  return (
    <>
      <form action={action} className="a-form" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <p className="a-small" style={{ margin: 0 }}>
          Signing in as <b>{email}</b>. Enter the 6-digit code from your authenticator app.
        </p>
        {state.error && (
          <div className="a-flash err" role="alert" style={{ marginBottom: 0 }}>
            <span>{state.error}</span>
          </div>
        )}
        <div className="a-field">
          <label htmlFor="ac">Code</label>
          <input
            id="ac"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            className="a-mono"
            style={{ fontSize: 22, letterSpacing: '.3em' }}
          />
        </div>
        <button className="a-btn copper block" disabled={pending} style={{ minHeight: 46 }}>
          {pending ? 'Checking…' : 'Continue'}
        </button>
      </form>
      <form action={cancelAdminLogin} style={{ marginTop: 12 }}>
        <button className="a-link muted" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', fontSize: 13.5 }}>
          Start again
        </button>
      </form>
    </>
  );
}
