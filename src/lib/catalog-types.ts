// Catalogue shapes and pack maths shared by server and browser code.
import { m2 } from './money';

export type Research = {
  level: 'pre' | 'lic'; // unlicensed research compound | licensed medicine elsewhere
  levelLabel: string;
  what: string;
  findings: string[];
  warning: string;
  searchTerm: string; // used for PubMed and ClinicalTrials.gov links
};

export type LotInfo = {
  code: string;
  productCode: string;
  productName: string;
  productSlug: string;
  purity: string;
  massDa: string | null;
  content: string | null;
  endotoxin: string | null;
  retention: string | null;
  lab: string | null;
  testedAt: string; // ISO
  reportUrl: string | null;
  isSample: boolean;
  isCurrent: boolean;
};

export type CatalogPack = { id: string; qty: number; price: number; tag: string | null };

/** Fields the browser needs (basket, search, cards). */
export type ClientProduct = {
  id: string;
  slug: string;
  code: string;
  name: string;
  fullName: string;
  altName: string | null;
  kind: 'single' | 'bundle';
  tagline: string;
  badge: string | null;
  image: string;
  imageWide: boolean;
  searchTerms: string;
  packs: CatalogPack[]; // active packs, smallest first
  vialsPerUnit: number; // 1 for a single vial, 2 for the duo
  compareUnit: number; // pence: what one unit costs bought singly (savings are measured against this)
  components: { slug: string; code: string; name: string; qty: number }[];
  lots: LotInfo[]; // current lot(s); a bundle lists its components' lots
  stockUnits: number | null; // null when stock is not tracked
  href: string;
};

/** Everything a product page needs. */
export type CatalogProduct = ClientProduct & {
  lede: string;
  highlights: string[];
  packImage: string | null;
  sequence: string | null;
  structure: string | null;
  massDa: string | null;
  contentMg: number;
  form: string;
  vial: string | null;
  storage: string;
  research: Research | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export const toClientProduct = (p: ClientProduct): ClientProduct => ({
  id: p.id,
  slug: p.slug,
  code: p.code,
  name: p.name,
  fullName: p.fullName,
  altName: p.altName,
  kind: p.kind,
  tagline: p.tagline,
  badge: p.badge,
  image: p.image,
  imageWide: p.imageWide,
  searchTerms: p.searchTerms,
  packs: p.packs,
  vialsPerUnit: p.vialsPerUnit,
  compareUnit: p.compareUnit,
  components: p.components,
  lots: p.lots,
  stockUnits: p.stockUnits,
  href: p.href,
});

export const vialsIn = (p: ClientProduct, packQty: number) => packQty * p.vialsPerUnit;
export const perVial = (p: ClientProduct, pack: CatalogPack) => Math.round(pack.price / vialsIn(p, pack.qty));
export const saving = (p: ClientProduct, pack: CatalogPack) => Math.max(0, p.compareUnit * pack.qty - pack.price);
export const unitWord = (p: ClientProduct, q: number) =>
  p.kind === 'bundle' ? (p.vialsPerUnit === 2 ? (q === 1 ? 'duo' : 'duos') : q === 1 ? 'set' : 'sets') : q === 1 ? 'vial' : 'vials';
export const packLabel = (p: ClientProduct, pack: CatalogPack) => `${pack.qty} ${unitWord(p, pack.qty)} · ${m2(perVial(p, pack))} a vial`;
export const inStock = (p: ClientProduct, packQty = 1) => p.stockUnits === null || p.stockUnits >= packQty;
export const firstPack = (p: ClientProduct) => p.packs[0];
export const lastPack = (p: ClientProduct) => p.packs[p.packs.length - 1];

/** Display name for a pack line: "Melanotan II 10 mg, 3 vials" (first pack keeps the plain name). */
export const packTitle = (p: ClientProduct, pack: CatalogPack) =>
  pack.qty === p.packs[0]?.qty ? p.fullName : `${p.fullName}, ${pack.qty} ${unitWord(p, pack.qty)}`;

export function findPack<T extends ClientProduct>(catalog: T[], packId: string) {
  for (const product of catalog) {
    const pack = product.packs.find((k) => k.id === packId);
    if (pack) return { product, pack };
  }
  return null;
}

export const bySlug = <T extends ClientProduct>(catalog: T[], slug: string) => catalog.find((p) => p.slug === slug);

/** Simple catalogue search over names, codes, lots and synonyms. */
export function searchCatalog<T extends ClientProduct>(catalog: T[], q: string): T[] {
  const s = q.toLowerCase().trim();
  if (!s) return [];
  return catalog.filter((p) =>
    [p.code, p.name, p.fullName, p.altName ?? '', p.searchTerms, ...p.lots.map((l) => l.code)]
      .join(' ')
      .toLowerCase()
      .includes(s),
  );
}
