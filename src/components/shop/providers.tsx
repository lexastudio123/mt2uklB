'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { findPack, unitWord, type ClientProduct } from '@/lib/catalog-types';
import { MAX_LINE_QTY, priceCart, type CartLine } from '@/lib/cart-math';
import type { PublicConfig } from '@/lib/settings';

// ───────── Shop data (catalogue, settings, session) ─────────

type ShopData = { catalog: ClientProduct[]; config: PublicConfig; signedIn: boolean };
const ShopCtx = createContext<ShopData | null>(null);
export function useShop(): ShopData {
  const c = useContext(ShopCtx);
  if (!c) throw new Error('useShop must be used inside <ShopProvider>');
  return c;
}

// ───────── UI state (drawers, overlays, toast) ─────────

type UI = {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  toast: (msg: string) => void;
};
const UICtx = createContext<UI | null>(null);
export function useUI(): UI {
  const c = useContext(UICtx);
  if (!c) throw new Error('useUI must be used inside <ShopProvider>');
  return c;
}

// ───────── Basket ─────────

type Cart = {
  ready: boolean;
  lines: CartLine[];
  priced: ReturnType<typeof priceCart>;
  count: number;
  add: (packId: string, qty?: number, opts?: { quiet?: boolean }) => boolean;
  setQty: (packId: string, qty: number) => void;
  remove: (packId: string) => void;
  clear: () => void;
};
const CartCtx = createContext<Cart | null>(null);
export function useCart(): Cart {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart must be used inside <ShopProvider>');
  return c;
}

export const CART_KEY = 'mt-cart';
export const PROMO_KEY = 'mt-promo';

export function store<T>(key: string, value?: T): T | null {
  try {
    if (value === undefined) {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  return null;
}

export function ShopProvider({ catalog, config, signedIn, children }: ShopData & { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  // Load the saved basket once, dropping anything no longer sold.
  useEffect(() => {
    const saved = store<CartLine[]>(CART_KEY);
    if (Array.isArray(saved)) setLines(saved.filter((l) => l && typeof l.packId === 'string' && findPack(catalog, l.packId)));
    setReady(true);
  }, [catalog]);

  useEffect(() => {
    if (ready) store(CART_KEY, lines);
  }, [lines, ready]);

  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CART_KEY) return;
      try {
        setLines(e.newValue ? JSON.parse(e.newValue) : []);
      } catch {}
    };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, []);

  // Close drawers when the page changes.
  useEffect(() => {
    setCartOpen(false);
    setSearchOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setCartOpen(false);
      setSearchOpen(false);
      setMenuOpen(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastOn(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOn(false), 2200);
  }, []);

  const priced = useMemo(() => priceCart(catalog, lines), [catalog, lines]);

  const add = useCallback(
    (packId: string, qty = 1, opts: { quiet?: boolean } = {}) => {
      const hit = findPack(catalog, packId);
      if (!hit) return false;
      const { product: p, pack: k } = hit;
      if (p.stockUnits !== null && p.stockUnits < k.qty) {
        toast(`${p.name} is out of stock in that pack size`);
        return false;
      }
      setLines((cur) => {
        const ex = cur.find((l) => l.packId === packId);
        if (ex) return cur.map((l) => (l.packId === packId ? { ...l, qty: Math.min(MAX_LINE_QTY, l.qty + qty) } : l));
        return [...cur, { packId, qty: Math.min(MAX_LINE_QTY, qty) }];
      });
      if (!opts.quiet) {
        toast(`Added ${p.code} · ${k.qty} ${unitWord(p, k.qty)}`);
        setCartOpen(true);
      }
      return true;
    },
    [catalog, toast],
  );

  const cart: Cart = useMemo(
    () => ({
      ready,
      lines,
      priced,
      count: priced.count,
      add,
      setQty: (packId, qty) =>
        setLines((cur) => (qty < 1 ? cur.filter((l) => l.packId !== packId) : cur.map((l) => (l.packId === packId ? { ...l, qty: Math.min(MAX_LINE_QTY, qty) } : l)))),
      remove: (packId) => setLines((cur) => cur.filter((l) => l.packId !== packId)),
      clear: () => setLines([]),
    }),
    [ready, lines, priced, add],
  );

  const ui: UI = useMemo(
    () => ({
      cartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      searchOpen,
      setSearchOpen,
      menuOpen,
      setMenuOpen,
      chatOpen,
      setChatOpen,
      toast,
    }),
    [cartOpen, searchOpen, menuOpen, chatOpen, toast],
  );

  return (
    <ShopCtx.Provider value={useMemo(() => ({ catalog, config, signedIn }), [catalog, config, signedIn])}>
      <UICtx.Provider value={ui}>
        <CartCtx.Provider value={cart}>
          {children}
          <div className={`toast${toastOn ? ' on' : ''}`} role="status" aria-live="polite">
            {toastMsg}
          </div>
        </CartCtx.Provider>
      </UICtx.Provider>
    </ShopCtx.Provider>
  );
}
