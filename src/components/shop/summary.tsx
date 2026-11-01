'use client';

import { useEffect, useRef, useState } from 'react';
import type { PricedLine } from '@/lib/cart-math';
import { deliveryFor } from '@/lib/cart-math';
import { m2 } from '@/lib/money';
import { IconBack, IconChat, IconLock } from '../icons';
import { PROMO_KEY, store, useCart, useShop } from './providers';

export type ServerQuote = {
  lines: PricedLine[];
  subtotal: number;
  full: number;
  shipping: number;
  freeShip: boolean;
  method: { id: string; name: string } | null;
  discount: number;
  code: { ok: true; code: string; label: string } | { ok: false; code: string; message: string } | null;
  credit: number;
  availableCredit: number;
  total: number;
  stockIssues: string[];
};

/**
 * Basket totals. Shows local prices instantly, then the server's figures
 * (discount codes, credit, stock) once they arrive.
 */
export function useQuote(opts: { shippingMethodId?: string; email?: string; useCredit?: boolean }) {
  const { lines, priced, ready } = useCart();
  const { config } = useShop();
  const [code, setCodeState] = useState<string>('');
  const [q, setQ] = useState<ServerQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const saved = store<string>(PROMO_KEY);
    if (saved) setCodeState(saved);
    // A code applied elsewhere on the page (the partner offer bar).
    const onPromo = (e: Event) => setCodeState(String((e as CustomEvent<string>).detail || ''));
    window.addEventListener('mt:promo', onPromo);
    return () => window.removeEventListener('mt:promo', onPromo);
  }, []);

  const setCode = (c: string) => {
    setCodeState(c);
    store(PROMO_KEY, c || null);
  };

  const key = JSON.stringify([lines, opts.shippingMethodId, code, opts.email, opts.useCredit]);
  useEffect(() => {
    if (!ready) return;
    if (!lines.length) {
      setQ(null);
      return;
    }
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'quote', lines, shippingMethodId: opts.shippingMethodId, code, email: opts.email, useCredit: opts.useCredit }),
        });
        if (r.ok && n === seq.current) setQ(await r.json());
      } catch {
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  // Local fallback until the server answers.
  const local = deliveryFor(config.methods, opts.shippingMethodId, priced.subtotal, config.freeOver, priced.lines.length > 0);
  const fresh = q && q.lines.length === priced.lines.length;
  const view: ServerQuote = fresh
    ? q!
    : {
        lines: priced.lines,
        subtotal: priced.subtotal,
        full: priced.full,
        shipping: local.price,
        freeShip: local.free,
        method: local.method ? { id: local.method.id, name: local.method.name } : null,
        discount: 0,
        code: null,
        credit: 0,
        availableCredit: 0,
        total: priced.subtotal + local.price,
        stockIssues: [],
      };
  return { quote: view, code, setCode, loading, synced: !!fresh && !loading };
}

export function SummaryLines({ lines }: { lines: PricedLine[] }) {
  return (
    <div className="k-slines">
      {lines.map((l) => (
        <div className="k-sline" key={l.key}>
          <span className="th">
            <img src={l.image} alt="" />
            <span className="q">{l.qty}</span>
          </span>
          <span style={{ minWidth: 0 }}>
            <b>{l.name}</b>
            <span>{l.meta}</span>
          </span>
          <span className="lp">
            {m2(l.total)}
            {l.full > l.total && <s>{m2(l.full)}</s>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PromoBox({ code, setCode, result }: { code: string; setCode: (c: string) => void; result: ServerQuote['code'] }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  if (code && (!result || result.ok)) {
    return (
      <div className="k-promo">
        <div className="k-small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>
            Code <b style={{ color: 'var(--k-ink)' }}>{code}</b> applied{result?.ok ? ` · ${result.label}` : ''}
          </span>
          <button className="k-link" style={{ fontSize: 13 }} onClick={() => setCode('')}>
            Remove
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="k-promo">
      {code && result && !result.ok ? (
        <div className="k-small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: 'var(--k-bad)' }}>
            {code}: {result.message}
          </span>
          <button className="k-link" style={{ fontSize: 13 }} onClick={() => setCode('')}>
            Remove
          </button>
        </div>
      ) : !open ? (
        <button className="k-link" style={{ fontSize: 14 }} onClick={() => setOpen(true)} id="kPromoOpen">
          Have a discount code?
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = val.trim().toUpperCase();
            if (v) setCode(v);
            setOpen(false);
            setVal('');
          }}
        >
          <label htmlFor="kPromoIn" className="k-sr">
            Discount code
          </label>
          <input id="kPromoIn" ref={input} value={val} onChange={(e) => setVal(e.target.value)} placeholder="Discount code" autoComplete="off" />
          <button className="k-btn sm ghost">Apply</button>
        </form>
      )}
    </div>
  );
}

export function Totals({ q, showMethod = true }: { q: ServerQuote; showMethod?: boolean }) {
  return (
    <div className="k-tots">
      <div>
        <span>Subtotal</span>
        <span>{m2(q.subtotal)}</span>
      </div>
      {q.full > q.subtotal && (
        <div className="save">
          <span>Volume savings included</span>
          <span>{m2(q.full - q.subtotal)}</span>
        </div>
      )}
      {q.discount > 0 && (
        <div className="save">
          <span>Discount</span>
          <span>−{m2(q.discount)}</span>
        </div>
      )}
      <div>
        <span>
          Delivery {showMethod && q.method && <span className="k-small">({q.method.name})</span>}
        </span>
        <span>{q.shipping ? m2(q.shipping) : 'Free'}</span>
      </div>
      {q.credit > 0 && (
        <div className="save">
          <span>Store credit</span>
          <span>−{m2(q.credit)}</span>
        </div>
      )}
      <div className="grand">
        <span>Total</span>
        <span>
          <small>GBP</small>
          {m2(q.total)}
        </span>
      </div>
    </div>
  );
}

export function Assure() {
  const { config } = useShop();
  return (
    <div className="k-assure">
      <div>
        <IconLock />
        <span>{config.card ? 'Secure checkout. Card details go straight to the payment provider.' : 'Secure checkout over an encrypted connection.'}</span>
      </div>
      <div>
        <IconBack />
        <span>{config.returnsDays} day returns on sealed vials.</span>
      </div>
      <div>
        <IconChat />
        <span>{config.chatEnabled ? 'Questions? Chat with us 24/7 for an instant reply.' : `Questions? Email ${config.supportEmail}.`}</span>
      </div>
    </div>
  );
}
