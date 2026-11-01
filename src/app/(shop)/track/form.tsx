'use client';

import { useActionState } from 'react';
import { Timeline } from '@/components/shop/timeline';
import { trackOrder, type TrackState } from './actions';

export function TrackForm({ order }: { order: string }) {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, {});
  const e = state.errors ?? {};
  return (
    <>
      <form action={action} className="k-form k-card" style={{ marginTop: 22 }} noValidate>
        <div className={`k-field${e.order ? ' bad' : ''}`}>
          <label htmlFor="kt-o">Order number</label>
          <input id="kt-o" name="order" placeholder="MT12345" autoComplete="off" autoCapitalize="characters" defaultValue={state.values?.order ?? order} />
          <span className="err">{e.order}</span>
        </div>
        <div className={`k-field${e.who ? ' bad' : ''}`}>
          <label htmlFor="kt-e">Email or postcode</label>
          <input id="kt-e" name="who" autoComplete="email" defaultValue={state.values?.who ?? ''} />
          <span className="err">{e.who}</span>
        </div>
        <div className="full">
          <button className="k-btn" disabled={pending}>
            {pending ? 'Checking…' : 'Track order'}
          </button>
        </div>
      </form>
      <div style={{ marginTop: 20 }} aria-live="polite">
        {state.notFound && (
          <div className="k-empty">
            <p style={{ margin: 0, color: 'var(--k-ink)' }}>We could not find an order with those details.</p>
            <p style={{ margin: '8px 0 0' }}>Check the order number in your confirmation email and use the same email or postcode as on the order.</p>
          </div>
        )}
        {state.result && (
          <div className="k-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
              <b style={{ fontSize: 17 }}>{state.result.number}</b>
              <span className={`k-pill ${state.result.tone}`}>{state.result.label}</span>
            </div>
            {state.result.stage >= 0 && <Timeline stage={state.result.stage} dates={state.result.dates} />}
            <p className="k-small" style={{ margin: '16px 0 0' }}>
              {state.result.note}
              {state.result.trackingUrl && (
                <>
                  {' '}
                  <a className="k-link" href={state.result.trackingUrl} target="_blank" rel="noopener">
                    Track with {state.result.carrier}
                  </a>
                </>
              )}
            </p>
            {state.result.orderUrl && (
              <p style={{ margin: '14px 0 0' }}>
                <a className="k-btn sm ghost" href={state.result.orderUrl}>
                  View order details
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
