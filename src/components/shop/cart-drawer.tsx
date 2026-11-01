'use client';

import Link from 'next/link';
import { IconX } from '../icons';
import { useCart, useShop, useUI } from './providers';
import { suggestFor } from '@/lib/cart-math';
import { m2, money } from '@/lib/money';
import { EtaLine } from './bits';

export function CartDrawer() {
  const { catalog, config } = useShop();
  const { cartOpen, closeCart, toast } = useUI();
  const { priced, lines, setQty, remove, add } = useCart();
  const left = config.freeOver - priced.subtotal;
  const ups = suggestFor(catalog, lines).slice(0, 2);
  return (
    <>
      <div className={`scrim${cartOpen ? ' open' : ''}`} onClick={closeCart} />
      <aside className={`cart${cartOpen ? ' open' : ''}`} aria-label="Basket" aria-hidden={!cartOpen}>
        <div className="cart-h">
          <h3 className="disp">Basket</h3>
          <button className="ib" aria-label="Close basket" onClick={closeCart}>
            <IconX />
          </button>
        </div>
        <div className="cart-b">
          {!priced.lines.length ? (
            <div className="empty">
              <p>Your basket is empty.</p>
              <Link className="btn ink" href="/shop" onClick={closeCart}>
                Shop vials
              </Link>
            </div>
          ) : (
            priced.lines.map((l) => (
              <div className="cl" key={l.key}>
                <div className="th">
                  <img src={l.image} alt="" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <b>{l.fullName}</b>
                  <span className="m">{l.meta}</span>
                  <div>
                    <span className="q">
                      <button aria-label="One fewer" onClick={() => setQty(l.packId, l.qty - 1)}>
                        −
                      </button>
                      <span>{l.qty}</span>
                      <button aria-label="One more" onClick={() => setQty(l.packId, l.qty + 1)}>
                        +
                      </button>
                    </span>
                  </div>
                </div>
                <div className="lp">
                  {m2(l.total)}
                  <button className="rm" onClick={() => remove(l.packId)}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {priced.lines.length > 0 && (
          <div className="cart-f">
            <div className="meter">
              {left > 0 ? `${m2(left)} more for free tracked delivery` : 'Free tracked delivery unlocked'}
              <div className="b">
                <i style={{ width: `${Math.min(100, (priced.subtotal / config.freeOver) * 100)}%` }} />
              </div>
            </div>
            <div className="tot">
              <span>Subtotal</span>
              <span>{m2(priced.subtotal)}</span>
            </div>
            <Link className="btn ink" href="/checkout" onClick={closeCart}>
              Checkout securely
            </Link>
            <Link className="vb" href="/basket" onClick={closeCart}>
              View basket
            </Link>
            {ups.length > 0 && (
              <div className="k-drawerx">
                <span className="lbl">Customers also add</span>
                {ups.map((s) => (
                  <div className="k-upc" key={s.packId}>
                    <Link className="th" href={s.product.href} onClick={closeCart}>
                      <img src={s.product.image} alt="" />
                    </Link>
                    <div style={{ minWidth: 0 }}>
                      <b>{s.title}</b>
                      <span>
                        {s.meta} · {money(s.price)}
                      </span>
                    </div>
                    <button
                      className="add"
                      onClick={() => {
                        if (add(s.packId, 1, { quiet: true })) toast(`Added ${s.title} to your basket`);
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            <EtaLine />
          </div>
        )}
      </aside>
    </>
  );
}
