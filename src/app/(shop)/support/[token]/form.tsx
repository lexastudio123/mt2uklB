'use client';

import { useActionState } from 'react';
import { replyToTicket, type ReplyState } from './actions';

export function ReplyForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(replyToTicket, {});
  return (
    <form action={action} className="k-form" style={{ gridTemplateColumns: 'minmax(0,1fr)', marginTop: 24 }} noValidate key={state.sentAt}>
      <input type="hidden" name="token" value={token} />
      <div className={`k-field${state.error ? ' bad' : ''}`}>
        <label htmlFor="rep">Add a reply</label>
        <textarea id="rep" name="body" />
        <span className="err">{state.error}</span>
      </div>
      <div>
        <button className="k-btn" disabled={pending}>
          {pending ? 'Sending…' : 'Send reply'}
        </button>
        {state.sentAt && (
          <span className="k-small" style={{ marginLeft: 12, color: 'var(--k-good)' }}>
            Sent. The team will reply by email.
          </span>
        )}
      </div>
    </form>
  );
}
