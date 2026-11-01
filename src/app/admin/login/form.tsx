'use client';

import { useActionState } from 'react';
import { adminLogin, type LoginState } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(adminLogin, {});
  return (
    <form action={action} className="a-form" noValidate>
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
