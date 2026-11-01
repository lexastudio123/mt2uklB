// Background content from the design. Factual, no dosing or usage information.
import Link from 'next/link';
import type { CatalogProduct } from '@/lib/catalog-types';
import { m2 } from '@/lib/money';

export const TIMELINE: [string, string][] = [
  ['1980s', 'University of Arizona researchers start work on alpha MSH analogues to study skin darkening without sun exposure.'],
  ['1990s', 'Melanotan II, a smaller cyclic analogue, is described. Small human studies of both compounds follow.'],
  ['2000s', 'Development of Melanotan I passes to Clinuvel as afamelanotide, for light sensitive conditions.'],
  ['2014', 'Afamelanotide is approved in the EU as Scenesse for erythropoietic protoporphyria.'],
  ['2019', 'US approval of Scenesse. Bremelanotide, which came from MT2 research, is approved in the US as Vyleesi.'],
];

export function CompareTable({ mt1, mt2 }: { mt1?: CatalogProduct; mt2?: CatalogProduct }) {
  const rows: [string, React.ReactNode, React.ReactNode][] = [
    ['Other names', 'Afamelanotide, Scenesse (licensed form)', 'None'],
    ['Structure', 'Linear, 13 amino acids', 'Cyclic, 7 amino acids'],
    ['Main receptors', 'MC1, the skin pigment receptor', 'MC1, MC3, MC4 and MC5'],
    [
      'Licensed medicine?',
      <>
        <span className="yes">Yes</span>, as Scenesse in the EU (2014) and US (2019), for erythropoietic protoporphyria
      </>,
      <>
        <span className="no">No</span>, not licensed anywhere
      </>,
    ],
    ['Led to', '·', 'Bremelanotide (Vyleesi, US 2019)'],
    ['Molecular mass', `${mt1?.massDa ?? '1646.9'} Da`, `${mt2?.massDa ?? '1024.2'} Da`],
  ];
  if (mt1?.packs[0] && mt2?.packs[0]) {
    rows.push([
      'Our vial',
      <>
        10 mg · {m2(mt1.packs[0].price)} ·{' '}
        <Link className="link" href={mt1.href}>
          View
        </Link>
      </>,
      <>
        10 mg · {m2(mt2.packs[0].price)} ·{' '}
        <Link className="link" href={mt2.href}>
          View
        </Link>
      </>,
    ]);
  }
  return (
    <div className="cmp-wrap">
      <table className="cmp">
        <thead>
          <tr>
            <th>
              <span className="k-sr">Compared</span>
            </th>
            <th>MT1</th>
            <th>MT2</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              <th>{r[0]}</th>
              <td>{r[1]}</td>
              <td>{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
