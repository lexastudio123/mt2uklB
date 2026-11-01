import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalog, toClientProduct, type CatalogProduct } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { packTitle, perVial } from '@/lib/catalog-types';
import { m2, money } from '@/lib/money';
import { cutoffLabel } from '@/lib/eta';
import { ProductDetail, OftenTogether } from '@/components/shop/product-detail';
import { ProductCard } from '@/components/shop/product-card';
import { LotReport, fdateLong } from '@/components/shop/lot-report';
import { Crumbs, Faq } from '@/components/shop/trust';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const catalog = await getCatalog();
  return { catalog, p: catalog.find((x) => x.slug === slug) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { p } = await load((await params).slug);
  if (!p) return { title: 'Not found' };
  return {
    title: p.seoTitle || p.fullName,
    description: p.seoDescription || p.lede,
    openGraph: { images: [{ url: p.image }] },
    alternates: { canonical: p.href },
  };
}

function Research({ p }: { p: CatalogProduct }) {
  const r = p.research;
  if (!r) return <p className="mute">Research summary coming soon.</p>;
  const term = encodeURIComponent(r.searchTerm || p.name);
  return (
    <div className="rs">
      <span className={`lvl${r.level === 'lic' ? ' lic' : ''}`}>
        <i />
        {r.levelLabel}
      </span>
      <h2>What it is</h2>
      <p>{r.what}</p>
      <h2>What the research shows</h2>
      <ul>
        {r.findings.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {r.warning && <div className="warnbox">{r.warning}</div>}
      <h2>Read the studies</h2>
      <div className="src">
        <a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${term}`} target="_blank" rel="noopener">
          PubMed
        </a>
        <a href={`https://clinicaltrials.gov/search?term=${term}`} target="_blank" rel="noopener">
          ClinicalTrials.gov
        </a>
        <Link href="/science">MT1 and MT2 explained</Link>
      </div>
      <p style={{ fontSize: 13, marginTop: 6 }}>
        Summaries describe published research, not effects you should expect. Sold for laboratory research only, not for human use. A tan is not sun
        protection.
      </p>
    </div>
  );
}

function Spec({ p, catalog }: { p: CatalogProduct; catalog: CatalogProduct[] }) {
  const lot = p.lots[0];
  const rows: [string, React.ReactNode][] =
    p.kind === 'bundle'
      ? [
          ['Contents', p.components.map((c) => `${c.qty} × ${catalog.find((x) => x.slug === c.slug)?.fullName ?? c.name}`).join(', ')],
          ['Form', p.form],
          ['Purity', '≥99% by HPLC, each vial'],
          ['Storage', p.storage],
        ]
      : ([
          ['Compound', `${p.name}${p.altName ? ` (${p.altName})` : ''}`],
          p.sequence ? ['Sequence', <span className="mono" style={{ fontSize: 13, wordBreak: 'break-all' }}>{p.sequence}</span>] : null,
          p.structure ? ['Structure', p.structure] : null,
          p.massDa ? ['Molecular mass', `${p.massDa} Da`] : null,
          ['Content', `${p.contentMg} mg per vial`],
          ['Form', p.form],
          ['Purity', `≥99% by HPLC${lot ? ` (current lot ${lot.purity}%)` : ''}`],
          p.vial ? ['Vial', p.vial] : null,
          ['Storage', p.storage],
        ].filter(Boolean) as [string, React.ReactNode][]);
  return (
    <table>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [{ catalog, p }, s] = await Promise.all([load(slug), getSettings()]);
  if (!p || !p.packs.length) notFound();
  const others = catalog.filter((x) => x.id !== p.id);
  const methods = s.shipping.methods.filter((m) => m.active);
  const std = methods.find((m) => m.freeOver) ?? methods[0];
  const exp = methods.find((m) => m !== std);
  const bundle = p.kind === 'bundle';
  const lot = p.lots[0];

  const lots = p.lots.length ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {p.lots.map((l) => (
        <LotReport key={l.code} lot={l} />
      ))}
    </div>
  ) : (
    <p className="mute">The report for the next lot will appear here before it ships.</p>
  );

  const delivery = (
    <div className="rs">
      <p>
        Dispatched the same working day when you order before {cutoffLabel(s.shipping.cutoffHour)} UK time.
        {std && ` ${std.name} costs ${m2(std.price)}${std.freeOver ? ` and is free over ${money(s.shipping.freeOver)}` : ''}`}
        {exp && `; ${exp.name}${exp.note ? ` (${exp.note.toLowerCase()})` : ''} is ${m2(exp.price)}`}.
      </p>
      <p>
        Plain padded envelope, no product names on the outside. Sealed vials can be returned within {s.returnsDays} days.{' '}
        <Link className="link" href="/delivery">
          Delivery details
        </Link>
      </p>
    </div>
  );

  // Often ordered together: this item plus the other compound (or more MT2 for the duo).
  const mt1 = catalog.find((x) => x.code === 'MT1');
  const mt2 = catalog.find((x) => x.code === 'MT2');
  const fbt = [{ packId: p.packs[0].id, name: p.fullName, meta: bundle ? '1 duo · this item' : '1 vial · this item', price: p.packs[0].price, image: p.image, checked: true, locked: true }];
  const partner = p.code === 'MT2' ? mt1 : p.code === 'MT1' ? mt2 : null;
  if (partner?.packs[0]) fbt.push({ packId: partner.packs[0].id, name: partner.fullName, meta: '1 vial · for comparison', price: partner.packs[0].price, image: partner.image, checked: true, locked: false });
  else if (bundle && mt2 && mt2.packs[2])
    fbt.push({ packId: mt2.packs[2].id, name: packTitle(mt2, mt2.packs[2]).replace(' 10 mg,', ','), meta: `${m2(perVial(mt2, mt2.packs[2]))} a vial`, price: mt2.packs[2].price, image: mt2.image, checked: false, locked: false });

  const faq: [string, React.ReactNode][] = [
    [
      'Which lot will I receive?',
      bundle
        ? `${p.lots.map((l) => `${l.productName} lot ${l.code}`).join(' and ')}, the lots shipping now. Both reports are online.`
        : lot
          ? `The lot shipping now is ${lot.code}, tested at ${lot.purity}% purity by HPLC with identity confirmed by mass spectrometry. Packs ship with the same lot in every vial.`
          : 'The current lot and its report are listed on the lot reports page. Packs ship with the same lot in every vial.',
    ],
    ['Is water included?', 'No. Vials contain lyophilised peptide only.'],
    [
      'How is it shipped?',
      `${std ? `${std.name} ` : ''}in a plain padded envelope, dispatched the same working day if you order before ${cutoffLabel(s.shipping.cutoffHour)}.${std ? ` ${m2(std.price)}, free over ${money(s.shipping.freeOver)}.` : ''}`,
    ],
    [
      'Can you advise on dosing or use?',
      'No. Our vials are for laboratory research only, and we do not give dosing, reconstitution or usage advice. The research tab summarises what published studies have looked at.',
    ],
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.fullName,
    description: p.seoDescription || p.lede,
    sku: p.code,
    brand: { '@type': 'Brand', name: s.storeName },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'GBP',
      lowPrice: (Math.min(...p.packs.map((k) => k.price)) / 100).toFixed(2),
      highPrice: (Math.max(...p.packs.map((k) => k.price)) / 100).toFixed(2),
      availability: p.stockUnits === 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="wrap ph" style={{ paddingBottom: 18 }}>
        <Crumbs items={[['Shop', '/shop'], [p.name]]} />
      </div>
      <ProductDetail
        p={toClientProduct(p)}
        lede={p.lede}
        packImage={p.packImage}
        strip={{
          lot: bundle ? 'Both current' : lot?.code ?? 'Coming soon',
          purity: bundle ? '≥99% both' : lot ? `${lot.purity}%` : '≥99%',
          tested: lot ? fdateLong(p.lots.map((l) => l.testedAt).sort().pop()!) : '·',
        }}
        panels={{ r: <Research p={p} />, s: <Spec p={p} catalog={catalog} />, l: lots, d: delivery }}
      />
      <section className="sec pdp-x" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <div>{fbt.length > 1 && <OftenTogether label={bundle ? 'Add more MT2' : 'Often ordered together'} items={fbt} />}</div>
          <div>
            <h2 className="disp">Questions</h2>
            <Faq items={faq} />
          </div>
        </div>
      </section>
      {others.length > 0 && (
        <section className="sec" style={{ paddingTop: 12 }}>
          <div className="wrap">
            <div className="sec-head">
              <h2 className="disp" style={{ fontSize: 'clamp(40px,4.4vw,64px)' }}>
                Also in the range
              </h2>
            </div>
            <div className={`grid${others.length === 2 ? ' two' : ''}`}>
              {others.map((o) => (
                <ProductCard key={o.id} p={toClientProduct(o)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
