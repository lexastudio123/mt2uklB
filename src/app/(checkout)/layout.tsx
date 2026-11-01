import Link from 'next/link';
import { getCatalog, toClientProduct } from '@/lib/catalog';
import { getSettings, publicConfig } from '@/lib/settings';
import { getCustomer } from '@/lib/auth';
import { ShopProvider } from '@/components/shop/providers';
import { IconLock } from '@/components/icons';

/** Enclosed checkout: no site navigation, just the brand and a way back to the basket. */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const [settings, catalog, customer] = await Promise.all([getSettings(), getCatalog(), getCustomer()]);
  return (
    <ShopProvider catalog={catalog.map(toClientProduct)} config={publicConfig(settings)} signedIn={!!customer}>
      <header className="k-ckhead">
        <div className="k-wrap">
          <Link className="brand" href="/">
            {settings.storeName}
          </Link>
          <span className="sec">
            <IconLock />
            Secure checkout
          </span>
          <Link className="k-link" href="/basket" style={{ fontSize: 14, fontWeight: 500 }}>
            Back to basket
          </Link>
        </div>
      </header>
      <main id="app">{children}</main>
    </ShopProvider>
  );
}
