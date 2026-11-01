'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AdminIcon } from './icons';

export type NavItem = { href: string; label: string; icon: string; count?: number; soft?: boolean; section?: string };

/** Sidebar + top bar. The sidebar slides in on small screens. */
export function AdminChrome({
  items,
  admin,
  logout,
  children,
}: {
  items: NavItem[];
  admin: { name: string; email: string; role: string };
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const path = usePathname() || '/admin';
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));
  let lastSection = '';
  return (
    <div className="a-shell">
      <aside className={`a-side${open ? ' open' : ''}`} aria-label="Admin navigation">
        <Link className="a-brand" href="/admin">
          MT2 LAB<small>UK</small>
          <em>Admin</em>
        </Link>
        <div className="a-tones" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <nav className="a-nav">
          {items.map((it) => {
            const head = it.section && it.section !== lastSection ? it.section : null;
            if (it.section) lastSection = it.section;
            return (
              <span key={it.href} style={{ display: 'contents' }}>
                {head && <span className="a-navsec">{head}</span>}
                <Link href={it.href} aria-current={active(it.href) ? 'page' : undefined}>
                  <AdminIcon name={it.icon} />
                  {it.label}
                  {!!it.count && <span className={`a-count${it.soft ? ' soft' : ''}`}>{it.count}</span>}
                </Link>
              </span>
            );
          })}
        </nav>
        <div className="a-sidefoot">
          <b>{admin.name}</b>
          {admin.email} · {admin.role}
          <div className="a-row">
            <Link href="/admin/account">Your account</Link>
            <form action={logout}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className={`a-scrim${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <div className="a-main">
        <header className="a-top">
          <button className="a-menubtn" aria-label="Open menu" onClick={() => setOpen(true)}>
            <AdminIcon name="menu" />
          </button>
          <form className="a-search" action="/admin/search" role="search">
            <AdminIcon name="search" />
            <label htmlFor="adm-q" className="a-sr">
              Search orders, customers, lots and messages
            </label>
            <input id="adm-q" name="q" placeholder="Search order number, email, name, lot, ticket" autoComplete="off" />
          </form>
          <div className="a-topright">
            <Link href="/" target="_blank" className="a-hide-sm">
              View shop ↗
            </Link>
          </div>
        </header>
        <main className="a-content" id="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
