import type { Metadata } from 'next';
import Link from 'next/link';
import { getCatalog } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { packLabel, searchCatalog } from '@/lib/catalog-types';
import { money } from '@/lib/money';
import { IconSearch } from '@/components/icons';
import { OpenChatButton } from '@/components/shop/bits';
import { KitCrumbs } from '@/components/shop/trust';
import { Popular } from '@/components/shop/basket-view';

export const metadata: Metadata = { title: 'Search', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim().slice(0, 80);
  const [catalog, s] = await Promise.all([getCatalog(), getSettings()]);
  const res = q ? searchCatalog(catalog, q) : [];
  return (
    <div className="k-page">
      <div className="k-wrap">
        <KitCrumbs items={[['Search']]} />
        <h1 className="k-h1">{q ? `Results for “${q}”` : 'Search'}</h1>
        <form className="k-helpsearch" role="search" action="/search">
          <IconSearch />
          <label htmlFor="kSqIn" className="k-sr">
            Search
          </label>
          <input id="kSqIn" name="q" defaultValue={q} placeholder="Search products and lot numbers" autoComplete="off" autoFocus={!q} />
        </form>
        {q && res.length > 0 && (
          <>
            <p className="k-small" style={{ marginTop: 14 }}>
              {res.length} {res.length === 1 ? 'result' : 'results'}
            </p>
            <div className="k-results">
              {res.map((p) => (
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
        )}
        {q && !res.length && (
          <>
            <div className="k-empty" style={{ marginTop: 24 }}>
              <p style={{ margin: 0, color: 'var(--k-ink)', fontSize: 17 }}>Nothing matches “{q}”.</p>
              <p style={{ margin: '8px 0 0' }}>Try a shorter word, check the spelling{s.chat.enabled ? ', or ask the assistant' : ''}.</p>
              {s.chat.enabled && <OpenChatButton className="k-btn">Ask the assistant</OpenChatButton>}
            </div>
            <Popular />
          </>
        )}
        {!q && <Popular />}
      </div>
    </div>
  );
}
