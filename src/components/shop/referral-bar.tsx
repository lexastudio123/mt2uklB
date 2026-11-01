'use client';

import { useEffect, useState } from 'react';
import { PROMO_KEY, store } from './providers';

type Offer = { code: string; discountPct: number };

/**
 * Shown to visitors who arrive through an affiliate link (?ref=CODE). One tap puts the code in the
 * basket; nothing is stored until they choose to, and the order is credited when the code is used.
 */
export function ReferralBar() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const u = new URL(window.location.href);
    const code = (u.searchParams.get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    if (!code) return;
    u.searchParams.delete('ref');
    window.history.replaceState(null, '', u.pathname + u.search + u.hash);
    let from = '';
    try {
      const r = document.referrer ? new URL(document.referrer) : null;
      if (r && r.host !== window.location.host) from = r.host;
    } catch {}
    fetch(`/api/affiliates/lookup?${new URLSearchParams({ code, visit: '1', land: u.pathname, from })}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ({ ok: true } & Offer) | null) => {
        if (j?.ok && store<string>(PROMO_KEY) !== j.code) setOffer({ code: j.code, discountPct: j.discountPct });
      })
      .catch(() => {});
  }, []);

  if (!offer) return null;
  const apply = () => {
    store(PROMO_KEY, offer.code);
    window.dispatchEvent(new CustomEvent('mt:promo', { detail: offer.code }));
    setApplied(true);
    setTimeout(() => setOffer(null), 6000);
  };
  return (
    <div className="k-refbar" role="region" aria-label="Partner offer">
      <div className="wrap">
        {applied ? (
          <p role="status">
            Code <b>{offer.code}</b> is in your basket{offer.discountPct ? `. Your ${offer.discountPct}% off shows in the basket and at checkout.` : '.'}
          </p>
        ) : offer.discountPct ? (
          <p>
            Partner offer: <b>{offer.discountPct}% off</b> your order with code <b>{offer.code}</b>.
          </p>
        ) : (
          <p>
            You followed a partner link. Add their code <b>{offer.code}</b> so they are credited for your order.
          </p>
        )}
        {!applied && (
          <button type="button" className="k-btn sm" onClick={apply}>
            {offer.discountPct ? 'Apply code' : 'Add code'}
          </button>
        )}
        <button type="button" className="x" aria-label="Close partner offer" onClick={() => setOffer(null)}>
          ×
        </button>
      </div>
    </div>
  );
}
