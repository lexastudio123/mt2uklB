'use client';

import Link from 'next/link';
import { useState } from 'react';
import { perVial, saving, unitWord, type ClientProduct } from '@/lib/catalog-types';
import { m2 } from '@/lib/money';
import { useCart } from './providers';

/** "The more you order, the less per vial" section on the home page. */
export function PackLadder({ product: p }: { product: ClientProduct }) {
  const { add } = useCart();
  const start = Math.min(2, p.packs.length - 1);
  const [pk, setPk] = useState(start);
  const first = p.packs[0];
  const last = p.packs[p.packs.length - 1];
  const sel = p.packs[pk];
  return (
    <div className="wrap ladder">
      <div>
        <span className="kick">Pack savings</span>
        <h2 className="disp" style={{ fontSize: 'clamp(44px,5.4vw,80px)', marginTop: 10 }}>
          The more you order, the less per vial.
        </h2>
        <p className="mute" style={{ marginTop: 16, maxWidth: '44ch' }}>
          {p.name} drops from {m2(perVial(p, first))} to {m2(perVial(p, last))} a vial in the {last.qty} pack. Packs ship with the same lot in every vial.
        </p>
        <p style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => add(sel.id)}>
            Add {sel.qty} {unitWord(p, sel.qty)} to basket
          </button>
          <Link className="btn ghost" href={p.href}>
            See {p.name}
          </Link>
        </p>
      </div>
      <div className="rungs">
        {p.packs.map((k, i) => (
          <button key={k.id} className="rung" aria-pressed={i === pk} onClick={() => setPk(i)}>
            <span className="dots">
              {Array.from({ length: k.qty }, (_, j) => (
                <i key={j} />
              ))}
            </span>
            <span>
              <b>
                {k.qty} {unitWord(p, k.qty)}
                {k.tag && <span className="tg">{k.tag}</span>}
              </b>
              <span>
                {m2(perVial(p, k))} a vial · {k.qty * 10} mg in total
              </span>
            </span>
            <span className="pr">
              {m2(k.price)}
              {i > 0 && saving(p, k) > 0 && <small>Save {m2(saving(p, k))}</small>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
