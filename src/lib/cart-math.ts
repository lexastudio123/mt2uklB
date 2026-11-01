// Basket pricing shared by the browser (instant display) and server (the price that is charged).
import { findPack, packLabel, packTitle, perVial, unitWord, vialsIn, type ClientProduct } from './catalog-types';
import { m2 } from './money';
import type { ShipMethod } from './eta';

export type CartLine = { packId: string; qty: number };

export type PricedLine = {
  key: string; // pack id
  packId: string;
  productId: string;
  slug: string;
  code: string;
  name: string; // line title
  fullName: string;
  meta: string; // "3 vials · £19.00 a vial"
  image: string;
  imageWide: boolean;
  href: string;
  packQty: number;
  vials: number; // vials per pack
  unitPrice: number;
  qty: number;
  total: number;
  full: number; // price if every unit were bought singly
  hint: string; // nudge towards the next pack size
};

export const MAX_LINE_QTY = 20;

export function priceCart(catalog: ClientProduct[], lines: CartLine[]) {
  const out: PricedLine[] = [];
  const invalid: CartLine[] = [];
  for (const l of lines) {
    const hit = findPack(catalog, l.packId);
    const qty = Math.max(1, Math.min(MAX_LINE_QTY, Math.floor(Number(l.qty) || 0)));
    if (!hit || !Number.isFinite(qty)) {
      invalid.push(l);
      continue;
    }
    const { product: p, pack: k } = hit;
    const idx = p.packs.findIndex((x) => x.id === k.id);
    const nx = p.packs[idx + 1];
    out.push({
      key: k.id,
      packId: k.id,
      productId: p.id,
      slug: p.slug,
      code: p.code,
      name: p.fullName,
      fullName: p.fullName,
      meta: packLabel(p, k),
      image: p.image,
      imageWide: p.imageWide,
      href: p.href,
      packQty: k.qty,
      vials: vialsIn(p, k.qty),
      unitPrice: k.price,
      qty,
      total: k.price * qty,
      full: Math.max(k.price, p.compareUnit * k.qty) * qty,
      hint: nx ? `Switch to ${nx.qty} ${unitWord(p, nx.qty)} for ${m2(perVial(p, nx))} a vial` : '',
    });
  }
  const subtotal = out.reduce((s, l) => s + l.total, 0);
  const full = out.reduce((s, l) => s + l.full, 0);
  const count = out.reduce((s, l) => s + l.qty, 0);
  return { lines: out, invalid, subtotal, full, count };
}

export function deliveryFor(methods: ShipMethod[], methodId: string | undefined | null, subtotal: number, freeOver: number, hasLines = true) {
  const method = methods.find((m) => m.id === methodId) ?? methods[0];
  if (!method) return { method: null, price: 0, free: false };
  const free = method.freeOver && subtotal >= freeOver;
  return { method, price: hasLines ? (free ? 0 : method.price) : 0, free };
}

/** Suggestions for "Customers also add" and "Complete your order". */
export function suggestFor(catalog: ClientProduct[], lines: CartLine[]) {
  const inCart = new Set(lines.map((l) => findPack(catalog, l.packId)?.product.slug).filter(Boolean) as string[]);
  const packIds = new Set(lines.map((l) => l.packId));
  const out: { product: ClientProduct; packId: string; title: string; meta: string; price: number }[] = [];
  const push = (p: ClientProduct | undefined, packIndex = 0) => {
    const k = p?.packs[packIndex];
    if (!p || !k || packIds.has(k.id) || out.some((o) => o.packId === k.id)) return;
    out.push({ product: p, packId: k.id, title: packTitle(p, k), meta: packLabel(p, k), price: k.price });
  };
  const singles = catalog.filter((p) => p.kind === 'single');
  const bundles = catalog.filter((p) => p.kind === 'bundle');
  const anyBundleInCart = bundles.some((b) => inCart.has(b.slug));
  // Pair a single with the other single for comparison research.
  for (const p of singles) if (inCart.has(p.slug) && !anyBundleInCart) singles.filter((o) => o !== p && !inCart.has(o.slug)).forEach((o) => push(o));
  for (const b of bundles) if (!inCart.has(b.slug)) push(b);
  const best = singles[0];
  if (best) push(best, Math.min(2, best.packs.length - 1));
  for (const p of singles) if (!inCart.has(p.slug)) push(p);
  return out;
}
