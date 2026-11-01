import 'server-only';
import { cache } from 'react';
import type { Lot, Product } from '@prisma/client';
import { db } from './db';
import type { CatalogProduct, LotInfo, Research } from './catalog-types';

export * from './catalog-types';

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function toLotInfo(l: Lot, p: Pick<Product, 'code' | 'name' | 'slug'>): LotInfo {
  return {
    code: l.code,
    productCode: p.code,
    productName: p.name,
    productSlug: p.slug,
    purity: l.purity,
    massDa: l.massDa,
    content: l.content,
    endotoxin: l.endotoxin,
    retention: l.retention,
    lab: l.lab,
    testedAt: l.testedAt.toISOString(),
    reportUrl: l.reportUrl,
    isSample: l.isSample,
    isCurrent: l.isCurrent,
  };
}

const packFilter = { where: { active: true }, orderBy: { qty: 'asc' as const } };
const lotFilter = { where: { isCurrent: true, isPublished: true }, take: 1 };

/** Active products with live packs, current lots and stock, for this request. */
export const getCatalog = cache(async (): Promise<CatalogProduct[]> => {
  const rows = await db.product.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      packs: packFilter,
      lots: lotFilter,
      bundleItems: { include: { product: { include: { packs: packFilter, lots: lotFilter } } } },
    },
  });

  return rows
    .filter((p) => p.packs.length > 0)
    .map((p): CatalogProduct => {
      const bundle = p.kind === 'bundle' && p.bundleItems.length > 0;
      const singleUnit = (packs: { qty: number; price: number }[]) => {
        const one = packs.find((k) => k.qty === 1);
        if (one) return one.price;
        return packs.length ? Math.round(Math.min(...packs.map((k) => k.price / k.qty))) : 0;
      };
      const compareUnit = bundle
        ? p.bundleItems.reduce((s, b) => s + singleUnit(b.product.packs) * b.qty, 0)
        : singleUnit(p.packs);
      const vialsPerUnit = bundle ? p.bundleItems.reduce((s, b) => s + b.qty, 0) : 1;

      let stockUnits: number | null;
      if (bundle) {
        const tracked = p.bundleItems.filter((b) => b.product.trackStock);
        stockUnits = tracked.length ? Math.min(...tracked.map((b) => Math.floor(b.product.stock / b.qty))) : null;
      } else {
        stockUnits = p.trackStock ? Math.max(0, p.stock) : null;
      }

      const lots: LotInfo[] = bundle
        ? p.bundleItems.flatMap((b) => b.product.lots.map((l) => toLotInfo(l, b.product)))
        : p.lots.map((l) => toLotInfo(l, p));

      return {
        id: p.id,
        slug: p.slug,
        code: p.code,
        name: p.name,
        fullName: p.fullName,
        altName: p.altName,
        kind: bundle ? 'bundle' : 'single',
        tagline: p.tagline,
        lede: p.lede,
        badge: p.badge,
        highlights: parseJson<string[]>(p.highlights, []),
        image: p.image,
        imageWide: p.imageWide,
        packImage: p.packImage,
        sequence: p.sequence,
        structure: p.structure,
        massDa: p.massDa,
        contentMg: p.contentMg,
        form: p.form,
        vial: p.vial,
        storage: p.storage,
        research: parseJson<Research | null>(p.research, null),
        searchTerms: p.searchTerms,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        packs: p.packs.map((k) => ({ id: k.id, qty: k.qty, price: k.price, tag: k.tag })),
        vialsPerUnit,
        compareUnit,
        components: bundle ? p.bundleItems.map((b) => ({ slug: b.product.slug, code: b.product.code, name: b.product.name, qty: b.qty })) : [],
        lots,
        stockUnits,
        href: `/products/${p.slug}`,
      };
    })
    .map((p) => (p.research && !p.research.findings ? { ...p, research: null } : p));
});

/** Published lots, newest first (lot reports page). */
export async function getPublishedLots(): Promise<LotInfo[]> {
  const lots = await db.lot.findMany({
    where: { isPublished: true, product: { active: true } },
    orderBy: [{ isCurrent: 'desc' }, { testedAt: 'desc' }],
    include: { product: true },
  });
  return lots.map((l) => toLotInfo(l, l.product));
}

export async function findLot(code: string): Promise<LotInfo | null> {
  const norm = code.trim().toUpperCase().replace(/\s+/g, '');
  if (!norm) return null;
  const candidates = [norm, norm.replace(/^([A-Z0-9]+?)(\d{4})$/, '$1-$2')];
  const lot = await db.lot.findFirst({
    where: { isPublished: true, code: { in: candidates } },
    include: { product: true },
  });
  return lot ? toLotInfo(lot, lot.product) : null;
}
