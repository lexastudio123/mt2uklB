import Link from 'next/link';
import { perVial, saving, type ClientProduct } from '@/lib/catalog-types';
import { m2, money } from '@/lib/money';
import { AddButton } from './bits';

/** Grid card used on the shop page, search and "Also in the range". */
export function ProductCard({ p, heading = 'h3', priority = false }: { p: ClientProduct; heading?: 'h2' | 'h3'; priority?: boolean }) {
  const H = heading;
  const first = p.packs[0];
  const last = p.packs[p.packs.length - 1];
  if (!first) return null;
  const bundle = p.kind === 'bundle';
  const save = bundle ? saving(p, first) : 0;
  const lot = bundle ? null : p.lots[0];
  const soldOut = p.stockUnits !== null && p.stockUnits < first.qty;
  return (
    <article className="gc">
      <Link className="im" href={p.href}>
        {p.badge ? <span className="badge">{p.badge}</span> : save > 0 ? <span className="badge">Save {money(save)}</span> : null}
        <img className={p.imageWide ? 'wide' : undefined} src={p.image} alt={`${p.fullName} vial`} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} />
      </Link>
      <div className="b">
        <H className="disp">{p.code}</H>
        <span className="m">
          {p.fullName}
          {bundle ? ' · 2 × 10 mg' : ' · lyophilised'}
        </span>
        <span className="m">{bundle ? `Lots ${p.lots.map((l) => l.code).join(' / ')} · both ≥99%` : lot ? `Lot ${lot.code} · ${lot.purity}% HPLC` : 'Lot report online'}</span>
        <div className="row">
          <span>
            <b>
              {bundle ? '' : 'From '}
              {m2(first.price)}
            </b>
            <small>{bundle ? 'Both vials' : last !== first ? `From ${m2(perVial(p, last))} a vial in a ${last.qty} pack` : 'Single vial'}</small>
          </span>
          {soldOut ? (
            <Link className="add" href={p.href} style={{ textDecoration: 'none' }}>
              Sold out
            </Link>
          ) : (
            <AddButton packId={first.id} />
          )}
        </div>
      </div>
    </article>
  );
}
