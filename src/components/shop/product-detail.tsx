'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { packTitle, perVial, saving, unitWord, type ClientProduct } from '@/lib/catalog-types';
import { m2 } from '@/lib/money';
import { EMAIL_RE } from '@/lib/site';
import { useCart, useShop, useUI } from './providers';
import { EtaLine } from './bits';
import { PayBadges, Trust } from './trust';

type Tab = 'r' | 's' | 'l' | 'd';

/** Product page: gallery, pack picker, add to basket, tabs and the sticky add bar. */
export function ProductDetail({
  p,
  lede,
  packImage,
  panels,
  strip,
}: {
  p: ClientProduct;
  lede: string;
  packImage: string | null;
  panels: Record<Tab, ReactNode>;
  strip: { lot: string; purity: string; tested: string };
}) {
  const { add } = useCart();
  const { config } = useShop();
  const [pk, setPk] = useState(0);
  const [view, setView] = useState<'v' | 'x'>('v');
  const [fade, setFade] = useState(false);
  const [tab, setTab] = useState<Tab>('r');
  const [stickyOn, setStickyOn] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const k = p.packs[pk];
  const bundle = p.kind === 'bundle';
  const full = p.compareUnit * k.qty;
  const available = (q: number) => p.stockUnits === null || p.stockUnits >= q;
  const soldOut = !available(p.packs[0].qty);

  useEffect(() => {
    const el = addRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setStickyOn(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('k-has-bar', stickyOn);
    return () => document.body.classList.remove('k-has-bar');
  }, [stickyOn]);

  const showImage = (v: 'v' | 'x') => {
    if (v === view) return;
    setFade(true);
    setTimeout(() => {
      setView(v);
      setFade(false);
    }, 150);
  };
  const img = view === 'x' && packImage ? packImage : p.image;
  const wide = view === 'x' || p.imageWide;
  const tabs: [Tab, string][] = [
    ['r', 'Research'],
    ['s', 'Specification'],
    ['l', bundle ? 'Lot reports' : 'Lot report'],
    ['d', 'Delivery'],
  ];

  return (
    <>
      <div className="wrap pdp">
        <div className="gal">
          <div className="stagep">
            <span className="tones" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <img className={wide ? 'wide' : undefined} src={img} alt={`${p.fullName} vial`} width={wide ? 1000 : 600} height={900} fetchPriority="high" style={{ opacity: fade ? 0 : 1 }} />
          </div>
          <div className="thumbs">
            <button aria-pressed={view === 'v'} aria-label="Product image" onClick={() => showImage('v')}>
              <img src={p.image} alt="" />
            </button>
            {packImage && (
              <button aria-pressed={view === 'x'} aria-label="Pack image" onClick={() => showImage('x')}>
                <img src={packImage} alt="" />
              </button>
            )}
            <button
              className="rep"
              aria-pressed="false"
              aria-label="Lot report"
              onClick={() => {
                setTab('l');
                tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
                <rect x="7" y="5" width="26" height="30" rx="2" fill="#fff" stroke="#6B5646" />
                <path d="M11 27 L16 27 L18 12 L20 27 L29 27" stroke="#C8794A" strokeWidth="2" fill="none" />
              </svg>
            </button>
          </div>
        </div>

        <div className="buy">
          <span className="kick">{p.tagline}</span>
          <h1 className="disp">{p.code}</h1>
          <div className="sub">
            {p.name}
            {p.altName ? ` · ${p.altName}` : ''}
          </div>
          <p className="lede">{lede}</p>
          <div className="strip">
            <div>
              <span>Lot shipping now</span>
              <b>{strip.lot}</b>
            </div>
            <div>
              <span>Purity (HPLC)</span>
              <b>{strip.purity}</b>
            </div>
            <div>
              <span>Identity</span>
              <b>MS confirmed</b>
            </div>
            <div>
              <span>Tested</span>
              <b>{strip.tested}</b>
            </div>
          </div>
          <div className="lbl">
            <span>Pack size</span>
            <span>Price per vial</span>
          </div>
          <div className="packs">
            {p.packs.map((x, i) => {
              const sv = saving(p, x);
              const ok = available(x.qty);
              return (
                <button key={x.id} aria-pressed={i === pk} onClick={() => setPk(i)} disabled={!ok} style={!ok ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
                  {x.tag && <span className="tg">{x.tag}</span>}
                  <b>
                    {x.qty} {unitWord(p, x.qty)}
                  </b>
                  <span className="pp">
                    {m2(x.price)} · {m2(perVial(p, x))} a vial
                  </span>
                  {!ok ? (
                    <em style={{ color: 'var(--umber)', fontWeight: 500 }}>Not enough stock</em>
                  ) : sv > 0 ? (
                    <em>
                      Save {m2(sv)}
                      {bundle ? ' vs separate' : ''}
                    </em>
                  ) : (
                    <em style={{ color: 'var(--umber)', fontWeight: 500 }}>{bundle ? 'One of each' : 'Single vial'}</em>
                  )}
                </button>
              );
            })}
          </div>
          <div className="buyrow">
            <div>
              <span className="t">{m2(k.price)}</span>
              {full > k.price && <s>{m2(full)}</s>}
              <span className="each">
                {k.qty} {unitWord(p, k.qty)} · {m2(perVial(p, k))} a vial
              </span>
            </div>
            {soldOut ? (
              <button className="btn ink" ref={addRef} disabled style={{ opacity: 0.6 }}>
                Sold out
              </button>
            ) : (
              <button className="btn ink" ref={addRef} onClick={() => add(k.id)}>
                Add to basket
              </button>
            )}
          </div>
          {soldOut && <BackInStock productId={p.id} name={p.name} />}
          <div className="kx">
            <EtaLine />
            <Trust
              items={[
                { icon: 'flask', t: 'Lot tested', s: 'HPLC and MS' },
                { icon: 'box', t: 'Plain parcel', s: config.methods[0]?.name ?? 'Tracked' },
                { icon: 'back', t: `${config.returnsDays} day returns`, s: 'Sealed vials' },
              ]}
            />
            <PayBadges card={config.card} bank={config.bank} />
          </div>
          <div className="ruo-box">For laboratory research use only. Not for human or veterinary use. We do not give dosing, reconstitution or usage advice.</div>
          <div className="ptabs" role="tablist" ref={tabsRef}>
            {tabs.map(([t, label]) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {label}
              </button>
            ))}
          </div>
          <div className="ppanel" role="tabpanel">
            {panels[tab]}
          </div>
        </div>
      </div>

      {!soldOut && (
        <div className={`k-sticky${stickyOn ? ' on' : ''}`} aria-hidden={!stickyOn}>
          <div className="in">
            <span className="th">
              <img src={p.image} alt="" />
            </span>
            <span className="t">
              <b>{packTitle(p, k)}</b>
              <span>
                {k.qty} {unitWord(p, k.qty)} · {m2(perVial(p, k))} a vial · {m2(k.price)}
              </span>
            </span>
            <button className="k-btn" tabIndex={stickyOn ? 0 : -1} onClick={() => add(k.id)}>
              Add to basket
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function BackInStock({ productId, name }: { productId: string; name: string }) {
  const { toast } = useUI();
  const [done, setDone] = useState(false);
  if (done) return <p className="k-small" style={{ marginTop: 10 }}>We will email you when {name} is back in stock.</p>;
  return (
    <form
      className="k-promo"
      style={{ marginTop: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value.trim();
        if (!EMAIL_RE.test(email)) return toast('Enter a valid email address');
        const r = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, productId }) });
        if (r.ok) setDone(true);
        else toast('Could not save that. Try again.');
      }}
    >
      <span className="k-small" style={{ color: 'var(--k-ink)', fontWeight: 600 }}>
        Email me when it is back
      </span>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input name="email" type="email" placeholder="Your email" autoComplete="email" style={{ flex: 1, minHeight: 44, borderRadius: 4, border: '1.5px solid var(--line-l)', padding: '0 12px', font: 'inherit' }} />
        <button className="k-btn sm ghost">Notify me</button>
      </div>
    </form>
  );
}

/** "Often ordered together" box under the product. */
export function OftenTogether({ label, items }: { label: string; items: { packId: string; name: string; meta: string; price: number; image: string; checked: boolean; locked: boolean }[] }) {
  const { add } = useCart();
  const { openCart, toast } = useUI();
  const [checked, setChecked] = useState(items.map((x) => x.checked));
  const total = items.reduce((s, x, i) => s + (checked[i] ? x.price : 0), 0);
  return (
    <div className="k-fbt">
      <b className="k-h3">{label}</b>
      <div className="items">
        {items.map((x, i) => (
          <label key={x.packId}>
            <input type="checkbox" checked={checked[i]} disabled={x.locked} onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} />
            <span className="th">
              <img src={x.image} alt="" />
            </span>
            <span>
              <b style={{ fontWeight: 600 }}>{x.name}</b>
              <br />
              <span className="k-small">{x.meta}</span>
            </span>
            <span style={{ fontWeight: 650 }}>{m2(x.price)}</span>
          </label>
        ))}
      </div>
      <div className="row">
        <span>
          Total <b>{m2(total)}</b>
        </span>
        <button
          className="k-btn sm"
          onClick={() => {
            const picked = items.filter((_, i) => checked[i]);
            let n = 0;
            for (const x of picked) if (add(x.packId, 1, { quiet: true })) n++;
            if (n) {
              openCart();
              toast(`Added ${n} ${n === 1 ? 'item' : 'items'} to your basket`);
            }
          }}
        >
          Add selected to basket
        </button>
      </div>
    </div>
  );
}
