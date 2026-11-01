import type { Metadata } from 'next';
import Link from 'next/link';
import { getCatalog, toClientProduct } from '@/lib/catalog';
import { ProductCard } from '@/components/shop/product-card';
import { Crumbs } from '@/components/shop/trust';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Melanotan I and II in 10 mg research vials, sold singly or in packs of up to 10. Every lot tested by HPLC and mass spectrometry.',
  alternates: { canonical: '/shop' },
};

export default async function ShopPage() {
  const catalog = await getCatalog();
  const maxPack = Math.max(1, ...catalog.flatMap((p) => p.packs.map((k) => k.qty)));
  return (
    <>
      <div className="wrap ph">
        <Crumbs items={[['Shop']]} />
        <h1 className="disp">Shop</h1>
        <p className="mute" style={{ marginTop: 12, maxWidth: '60ch' }}>
          Melanotan I and II in 10 mg vials, sold singly or in packs of up to {maxPack}. Every lot tested by HPLC and mass spectrometry.
        </p>
      </div>
      <div className="wrap" style={{ paddingBottom: 72 }}>
        <div className="grid">
          {catalog.map((p, i) => (
            <ProductCard key={p.id} p={toClientProduct(p)} heading="h2" priority={i < 3} />
          ))}
        </div>
        <div className="duo-band" style={{ marginTop: 28 }}>
          <div>
            <span className="kick">Not sure which to choose?</span>
            <h3 className="disp" style={{ marginTop: 6 }}>
              Compare MT1 and MT2
            </h3>
            <p>Structure, receptors and licensing status, side by side.</p>
          </div>
          <div className="r">
            <Link className="btn" href="/science">
              Read the comparison
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
