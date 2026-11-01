'use client';

import { useActionState } from 'react';
import { sendContact, type ContactState } from './actions';

export function ContactForm({ topics, defaults }: { topics: string[]; defaults: { name: string; email: string; order: string; topic: string } }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, {});
  if (state.ok) {
    return (
      <div className="k-card">
        <b className="k-h3">Thanks, your message is with the team</b>
        <p className="k-small" style={{ margin: '8px 0 0' }}>
          Your reference is <b style={{ color: 'var(--k-ink)' }}>{state.ref}</b>. We have emailed you a copy and will reply by email, usually within a few hours.
        </p>
      </div>
    );
  }
  const e = state.errors ?? {};
  const v = state.values ?? defaults;
  return (
    <form action={action} className="k-form" noValidate>
      <div className={`k-field${e.name ? ' bad' : ''}`}>
        <label htmlFor="kc-n">Name</label>
        <input id="kc-n" name="name" autoComplete="name" defaultValue={v.name} />
        <span className="err">{e.name}</span>
      </div>
      <div className={`k-field${e.email ? ' bad' : ''}`}>
        <label htmlFor="kc-e">Email</label>
        <input id="kc-e" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={v.email} />
        <span className="err">{e.email}</span>
      </div>
      <div className="k-field">
        <label htmlFor="kc-t">Topic</label>
        <select id="kc-t" name="topic" defaultValue={v.topic || topics[0]}>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="k-field">
        <label htmlFor="kc-o">
          Order number <span className="opt">(optional)</span>
        </label>
        <input id="kc-o" name="order" autoComplete="off" placeholder="MT12345" defaultValue={v.order} />
      </div>
      <div className={`k-field full${e.message ? ' bad' : ''}`}>
        <label htmlFor="kc-m">Message</label>
        <textarea id="kc-m" name="message" defaultValue={state.values?.message ?? ''} />
        <span className="err">{e.message}</span>
      </div>
      {/* Honeypot: real people never fill this in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} />
      <div className="full">
        <button className="k-btn" disabled={pending}>
          {pending ? 'Sending…' : 'Send message'}
        </button>
        {state.error && (
          <p className="k-small" style={{ margin: '10px 0 0', color: 'var(--k-bad)' }} aria-live="polite">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
