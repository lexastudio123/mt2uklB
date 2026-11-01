'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { suggestFor } from '@/lib/cart-math';
import { m2, money } from '@/lib/money';
import { packLabel } from '@/lib/catalog-types';
import { useCart, useShop, useUI } from './providers';
import { EtaLine } from './bits';
import { PayBadges } from './trust';
import { Assure, PromoBox, SummaryLines, Totals, useQuote } from './summary';

export function FreeBar({ sub }: { sub: number }) {
  const { config } = useShop();
  const left = config.freeOver - sub;
  return (
    <>
      <div className="k-small" style={{ color: 'var(--k-ink)' }}>
        {left > 0 ? (
          <>
            You are <b>{m2(left)}</b> away from free tracked delivery
          </>
        ) : (
          <>
            <b>Free tracked delivery</b> unlocked
          </>
        )}
      </div>
      <div className="k-bar">
        <i style={{ width: `${Math.min(100, (sub / config.freeOver) * 100)}%` }} />
      </div>
    </>
  );
}

export function Popular() {
  const { catalog } = useShop();
  const items = catalog.slice(0, 4);
  if (!items.length) return null;
  return (
    <>
      <h2 className="k-h2" style={{ margin: '40px 0 0', fontSize: 22 }}>
        Popular right now
      </h2>
      <div className="k-results">
        {items.map((p) => (
          <Link className="k-res" href={p.href} key={p.id}>
            <span className="im">
              <img src={p.image} alt="" loading="lazy" />
            </span>
            <span className="t">
              <b>{p.fullName}</b>
              <span>
                {p.packs[0] ? packLabel(p, p.packs[0]) : ''}
                {p.packs[0] ? ` · from ${money(p.packs[0].price)}` : ''}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

export function BasketView() {
  const { catalog, config } = useShop();
  const { priced, lines, setQty, remove, add, ready } = useCart();
  const { toast } = useUI();
  const { quote, code, setCode } = useQuote({});
  const ups = suggestFor(catalog, lines).slice(0, 3);

  useEffect(() => {
    document.body.classList.add('k-has-mbar');
    return () => document.body.classList.remove('k-has-mbar');
  }, []);

  if (ready && !priced.lines.length) {
    return (
      <div className="k-page">
        <div className="k-wrap">
          <nav className="k-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span>Basket</span>
          </nav>
          <h1 className="k-h1">Your basket</h1>
          <div className="k-empty" style={{ marginTop: 24 }}>
            <p style={{ margin: 0, fontSize: 17, color: 'var(--k-ink)' }}>Your basket is empty.</p>
            <p style={{ margin: '8px 0 0' }}>Browse the range, or ask the assistant to help you find something.</p>
            <Link className="k-btn" href="/shop">
              Start shopping
            </Link>
          </div>
          <Popular />
        </div>
      </div>
    );
  }

  return (
    <div className="k-page has-mbar">
      <div className="k-wrap">
        <nav className="k-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Basket</span>
        </nav>
        <h1 className="k-h1">
          Your basket{' '}
          <span className="k-mute" style={{ fontSize: '.5em', fontWeight: 500, letterSpacing: 0 }}>
            {priced.count} {priced.count === 1 ? 'item' : 'items'}
          </span>
        </h1>
        <div className="k-cart" style={{ marginTop: 22 }}>
          <div style={{ minWidth: 0 }}>
            <FreeBar sub={priced.subtotal} />
            <div style={{ marginTop: 6 }}>
              {priced.lines.map((l) => (
                <div className="k-cline" key={l.key}>
                  <Link className="th" href={l.href}>
                    <img src={l.image} alt="" />
                  </Link>
                  <div style={{ minWidth: 0 }}>
                    <b>
                      <Link href={l.href}>{l.name}</Link>
                    </b>
                    <span className="meta">{l.meta}</span>
                    <div className="row">
                      <span className="k-qty">
                        <button aria-label="One fewer" onClick={() => setQty(l.packId, l.qty - 1)}>
                          −
                        </button>
                        <span>{l.qty}</span>
                        <button aria-label="One more" onClick={() => setQty(l.packId, l.qty + 1)}>
                          +
                        </button>
                      </span>
                      <button className="k-link" style={{ fontSize: 13.5, fontWeight: 500 }} onClick={() => remove(l.packId)}>
                        Remove
                      </button>
                      {l.hint && (
                        <span className="k-small" style={{ color: 'var(--k-good)' }}>
                          {l.hint}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="lp">
                    {m2(l.total)}
                    {l.full > l.total && <small>You save {m2(l.full - l.total)}</small>}
                  </div>
                </div>
              ))}
            </div>
            {quote.stockIssues.length > 0 && (
              <div className="k-note" style={{ marginTop: 16 }}>
                {quote.stockIssues.join(' ')}
              </div>
            )}
            {ups.length > 0 && (
              <>
                <h2 className="k-h2" style={{ margin: '36px 0 14px', fontSize: 22 }}>
                  Complete your order
                </h2>
                <div className="k-up">
                  {ups.map((s) => (
                    <div className="k-upc" key={s.packId}>
                      <Link className="th" href={s.product.href}>
                        <img src={s.product.image} alt="" />
                      </Link>
                      <div style={{ minWidth: 0 }}>
                        <b>{s.title}</b>
                        <span>
                          {s.meta} · {money(s.price)}
                        </span>
                        <br />
                        <button className="add" onClick={() => add(s.packId, 1, { quiet: true }) && toast(`Added ${s.title} to your basket`)}>
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="k-sumcard">
            <div className="k-card">
              <h2 className="k-h2" style={{ fontSize: 20, marginBottom: 6 }}>
                Order summary
              </h2>
              <SummaryLines lines={quote.lines} />
              <PromoBox code={code} setCode={setCode} result={quote.code} />
              <Totals q={quote} />
              <Link className="k-btn block" href="/checkout" style={{ marginTop: 16 }}>
                Checkout securely
              </Link>
              <div style={{ marginTop: 12 }}>
                <PayBadges card={config.card} bank={config.bank} />
              </div>
            </div>
            <div className="k-card" style={{ padding: 16 }}>
              <EtaLine />
            </div>
            <Assure />
          </aside>
        </div>
        <div className="k-mbar">
          <span>
            <span className="k-small">Total incl. delivery</span>
            <br />
            <b>{m2(quote.total)}</b>
          </span>
          <Link className="k-btn" href="/checkout">
            Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
