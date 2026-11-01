'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconBag, IconMenu, IconSearch, IconUser, IconX } from '../icons';
import { useCart, useShop, useUI } from './providers';
import { packLabel, searchCatalog } from '@/lib/catalog-types';
import { m2 } from '@/lib/money';

const HELP_ROUTES = ['/help', '/delivery', '/returns', '/track', '/contact'];

export function SiteHeader() {
  const { catalog } = useShop();
  const { count } = useCart();
  const { openCart, setSearchOpen, setMenuOpen } = useUI();
  const path = usePathname() || '/';
  const singles = catalog.filter((p) => p.kind === 'single');
  const active = (href: string) => (href === '/help' ? HELP_ROUTES.some((r) => path.startsWith(r)) : path === href || path.startsWith(href + '/'));
  const nav = [
    { href: '/shop', label: 'Shop' },
    ...singles.map((p) => ({ href: p.href, label: p.name })),
    { href: '/science', label: 'The science' },
    { href: '/lot-reports', label: 'Lot reports' },
    { href: '/help', label: 'Help' },
  ];
  return (
    <header className="site">
      <div className="wrap hdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="ib menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <IconMenu />
          </button>
          <Link className="logo" href="/">
            MT2 LAB <small>UK</small>
          </Link>
        </div>
        <nav className="main" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="tools">
          <Link className="ib acct" href="/account" aria-label="My account">
            <IconUser />
          </Link>
          <button className="ib" aria-label="Search" onClick={() => setSearchOpen(true)}>
            <IconSearch />
          </button>
          <button className="ib" aria-label={`Open basket, ${count} ${count === 1 ? 'item' : 'items'}`} onClick={openCart}>
            <IconBag />
            <span className="n">{count}</span>
          </button>
        </div>
      </div>
      <div className="tones" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    </header>
  );
}

export function MobileNav() {
  const { catalog } = useShop();
  const { menuOpen, setMenuOpen } = useUI();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (menuOpen) close.current?.focus();
  }, [menuOpen]);
  if (!menuOpen) return null;
  return (
    <div className="drawer-nav" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.target === e.currentTarget && setMenuOpen(false)}>
      <nav className="panel" aria-label="Menu" onClick={(e) => (e.target as HTMLElement).closest('a') && setMenuOpen(false)}>
        <button ref={close} className="ib x" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
          <IconX />
        </button>
        <Link href="/">Home</Link>
        <Link href="/shop">Shop</Link>
        {catalog.map((p) => (
          <Link key={p.id} href={p.href}>
            {p.kind === 'bundle' ? 'The duo' : p.name}
          </Link>
        ))}
        <Link href="/science">The science</Link>
        <Link href="/lot-reports">Lot reports</Link>
        <div style={{ height: 18 }} />
        <Link className="s" href="/help">Help centre</Link>
        <Link className="s" href="/track">Track an order</Link>
        <Link className="s" href="/account">My account</Link>
        <Link className="s" href="/contact">Contact</Link>
      </nav>
    </div>
  );
}

export function SearchOverlay() {
  const { catalog } = useShop();
  const { searchOpen, setSearchOpen } = useUI();
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (searchOpen) {
      setQ('');
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [searchOpen]);
  const results = useMemo(() => (q.trim() ? searchCatalog(catalog, q) : catalog), [catalog, q]);
  if (!searchOpen) return null;
  const go = () => {
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  return (
    <div className="search-ov" onClick={(e) => (e.target === e.currentTarget || (e.target as HTMLElement).closest('a')) && setSearchOpen(false)}>
      <div className="b" role="dialog" aria-label="Search">
        <label htmlFor="sq" style={{ position: 'absolute', left: -9999 }}>
          Search
        </label>
        <input
          id="sq"
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && q.trim() && go()}
          placeholder="Search MT1, MT2, lot numbers"
          autoComplete="off"
        />
        <ul>
          {results.length ? (
            results.map((p) => (
              <li key={p.id}>
                <Link href={p.href}>
                  <span>
                    {p.fullName}{' '}
                    <span className="mute" style={{ fontSize: 13 }}>
                      {p.packs[0] ? packLabel(p, p.packs[0]) : ''}
                    </span>
                  </span>
                  <span>{p.packs[0] ? m2(p.packs[0].price) : ''}</span>
                </Link>
              </li>
            ))
          ) : (
            <li style={{ padding: 14 }} className="mute">
              No match. Try “MT2”, or ask the assistant.
            </li>
          )}
          {q.trim() && (
            <li>
              <Link className="all" href={`/search?q=${encodeURIComponent(q.trim())}`}>
                See all results for “{q.trim()}”
              </Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
