import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedLots } from '@/lib/catalog';
import { LotReport, fdateLong } from '@/components/shop/lot-report';
import { LotLookup } from '@/components/shop/lot-lookup';
import { Crumbs } from '@/components/shop/trust';

export const metadata: Metadata = {
  title: 'Lot reports',
  description: 'HPLC purity, mass spectrometry identity, content and endotoxin results for every lot we ship. Check the lot number on your label.',
  alternates: { canonical: '/lot-reports' },
};

export default async function LotReportsPage() {
  const lots = await getPublishedLots();
  const current = lots.filter((l) => l.isCurrent);
  const past = lots.filter((l) => !l.isCurrent);
  return (
    <section className="dark" style={{ paddingBlock: '56px 64px' }}>
      <div className="wrap">
        <Crumbs dark items={[['Lot reports']]} />
        <h1 className="disp" style={{ fontSize: 'clamp(56px,8vw,120px)', marginTop: 14 }}>
          Lot reports
        </h1>
        <p className="mute" style={{ maxWidth: '60ch', marginTop: 16 }}>
          Every lot is tested by an independent lab for purity (HPLC), identity (mass spectrometry), content and endotoxin before it is listed. These are the
          lots shipping now.
        </p>
        <div className="lot" style={{ marginTop: 36 }}>
          {current.map((l) => (
            <div key={l.code}>
              <p className="mono" style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--copper-hi)', margin: '0 0 8px' }}>
                {l.productName} · shipping now ·{' '}
                <Link href={`/lot-reports/${l.code}`} style={{ color: 'inherit' }}>
                  permalink
                </Link>
              </p>
              <LotReport lot={l} />
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 640, marginTop: 36 }}>
          <LotLookup hint="Lot numbers look like MT2-2611." formStyle={{ maxWidth: 560 }} outStyle={{ marginTop: 16 }} />
        </div>
        {past.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 className="disp" style={{ fontSize: 40 }}>
              Earlier lots
            </h2>
            <div className="lotlist">
              {past.map((l) => (
                <Link key={l.code} href={`/lot-reports/${l.code}`}>
                  <b>{l.code}</b>
                  <span>{l.productName}</span>
                  <span>{l.purity}%</span>
                  <span>{fdateLong(l.testedAt)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
