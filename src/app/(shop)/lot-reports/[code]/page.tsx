import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findLot } from '@/lib/catalog';
import { LotReport } from '@/components/shop/lot-report';
import { Crumbs } from '@/components/shop/trust';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lot = await findLot(decodeURIComponent((await params).code));
  return lot ? { title: `Lot ${lot.code}`, description: `${lot.productName} lot ${lot.code}: ${lot.purity}% purity by HPLC.` } : { title: 'Lot not found' };
}

/** Permanent page for one lot (handy for a QR code on the vial label). */
export default async function LotPage({ params }: Props) {
  const code = decodeURIComponent((await params).code);
  const lot = await findLot(code);
  if (!lot) notFound();
  return (
    <section className="dark" style={{ paddingBlock: '56px 64px' }}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <Crumbs dark items={[['Lot reports', '/lot-reports'], [lot.code]]} />
        <h1 className="disp" style={{ fontSize: 'clamp(48px,7vw,96px)', marginTop: 14 }}>
          Lot {lot.code}
        </h1>
        <p className="mute" style={{ marginTop: 12 }}>
          {lot.productName}
          {lot.isCurrent ? ' · the lot shipping now' : ' · an earlier lot'}
          {lot.lab ? ` · tested by ${lot.lab}` : ''}
        </p>
        <div style={{ marginTop: 26 }}>
          <LotReport lot={lot} />
        </div>
        <p style={{ marginTop: 26, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link className="btn" href={`/products/${lot.productSlug}`}>
            View {lot.productName}
          </Link>
          <Link className="btn ghost" href="/lot-reports" style={{ color: 'var(--crema)' }}>
            All lot reports
          </Link>
        </p>
      </div>
    </section>
  );
}
