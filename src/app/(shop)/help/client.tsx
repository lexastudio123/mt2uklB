'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { HelpCategory } from '@/content/help';
import { IconSearch } from '@/components/icons';
import { OpenChatButton } from '@/components/shop/bits';
import { Faq, KitCrumbs } from '@/components/shop/trust';
import { useShop } from '@/components/shop/providers';

export function HelpCentre({ cats }: { cats: HelpCategory[] }) {
  const { config } = useShop();
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cats
      .filter((c) => !cat || c.cat === cat)
      .map((c) => ({ cat: c.cat, items: c.items.filter(([qq, a]) => !s || `${qq} ${a}`.toLowerCase().includes(s)) }))
      .filter((c) => c.items.length);
  }, [cats, cat, q]);
  return (
    <div className="k-page">
      <div className="k-wrap">
        <KitCrumbs items={[['Help centre']]} />
        <h1 className="k-h1">How can we help?</h1>
        <form className="k-helpsearch" role="search" onSubmit={(e) => e.preventDefault()}>
          <IconSearch />
          <label htmlFor="kHsIn" className="k-sr">
            Search help
          </label>
          <input id="kHsIn" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions, for example delivery times" autoComplete="off" />
        </form>
        <div className="k-chips">
          <button aria-pressed={cat === ''} onClick={() => setCat('')}>
            All topics
          </button>
          {cats.map((c) => (
            <button key={c.cat} aria-pressed={cat === c.cat} onClick={() => setCat(c.cat)}>
              {c.cat}
            </button>
          ))}
        </div>
        <div className="k-helpgrid">
          <div>
            {groups.length ? (
              groups.map((g) => (
                <div key={g.cat}>
                  <h2 className="k-h2" style={{ fontSize: 20, margin: '22px 0 4px' }}>
                    {g.cat}
                  </h2>
                  <Faq items={g.items} />
                </div>
              ))
            ) : (
              <div className="k-empty">
                <p style={{ margin: 0, color: 'var(--k-ink)' }}>No answers match “{q}”.</p>
                <p style={{ margin: '8px 0 0' }}>{config.chatEnabled ? 'Ask the assistant instead, it replies instantly.' : 'Send us a message instead.'}</p>
                <OpenChatButton className="k-btn">{config.chatEnabled ? 'Ask the assistant' : 'Contact us'}</OpenChatButton>
              </div>
            )}
          </div>
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 'calc(96px + env(safe-area-inset-top,0px))' }}>
            {config.chatEnabled && (
              <div className="k-card">
                <b className="k-h3">Ask the assistant</b>
                <p className="k-small" style={{ margin: '6px 0 14px' }}>
                  Instant answers 24/7. It can find products, check delivery dates and help with an order.
                </p>
                <OpenChatButton className="k-btn block">Start a chat</OpenChatButton>
              </div>
            )}
            <div className="k-card">
              <b className="k-h3">Popular links</b>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, fontSize: 14.5 }}>
                <Link className="k-link" href="/track">
                  Track an order
                </Link>
                <Link className="k-link" href="/delivery">
                  Delivery options and times
                </Link>
                <Link className="k-link" href="/returns">
                  Returns and refunds
                </Link>
                <Link className="k-link" href="/contact">
                  Contact us
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
