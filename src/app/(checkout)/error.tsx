'use client';

import Link from 'next/link';

/** Checkout failure screen. Nothing is charged unless the payment page confirmed it. */
export default function CheckoutError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="k-page">
      <div className="k-wrap k-narrow">
        <h1 className="k-h1">Checkout hit a problem</h1>
        <p className="k-lede">Nothing has been charged. Your basket is still saved on this device.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <button className="k-btn" onClick={reset}>
            Try again
          </button>
          <Link className="k-btn ghost" href="/basket">
            Back to basket
          </Link>
        </div>
      </div>
    </div>
  );
}
