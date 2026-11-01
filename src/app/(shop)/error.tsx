'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Shown inside the site layout if a page fails unexpectedly. */
export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="wrap ph" style={{ paddingBlock: 96 }}>
      <h1 className="disp">Something went wrong</h1>
      <p className="mute" style={{ marginTop: 12, maxWidth: '56ch' }}>
        Sorry, this page did not load. Your basket is safe. Try again, or contact us if it keeps happening
        {error.digest ? ` (reference ${error.digest})` : ''}.
      </p>
      <p style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn ink" onClick={reset}>
          Try again
        </button>
        <Link className="btn ghost" href="/contact">
          Contact us
        </Link>
      </p>
    </div>
  );
}
