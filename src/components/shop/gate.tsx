'use client';

import { useState } from 'react';

/** Research-use-only notice shown once per browser. The layout only renders it when the cookie is missing. */
export function RuoGate({ storeName }: { storeName: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const accept = () => {
    document.cookie = `mt_ruo=1; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setOpen(false);
  };
  return (
    <div className="gate">
      <div className="g" role="dialog" aria-modal="true" aria-labelledby="gt">
        <h4 id="gt">Research use only</h4>
        <p>
          {storeName} supplies Melanotan I and II for in vitro laboratory research by people aged 18 or over. Nothing on this site is for human or
          veterinary use, and nothing here is medical advice.
        </p>
        <div className="row">
          <button className="btn" onClick={accept} autoFocus>
            I am 18+ and understand
          </button>
          <a className="btn ghost" href="https://www.gov.uk/search/all?keywords=melanotan" rel="noopener" style={{ color: 'var(--crema)' }}>
            Leave
          </a>
        </div>
      </div>
    </div>
  );
}
