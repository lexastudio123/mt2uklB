import Link from 'next/link';
import { cookies } from 'next/headers';
import { getCatalog, toClientProduct } from '@/lib/catalog';
import { getSettings, publicConfig } from '@/lib/settings';
import { getCustomer } from '@/lib/auth';
import { money } from '@/lib/money';
import { ShopProvider } from '@/components/shop/providers';
import { MobileNav, SearchOverlay, SiteHeader } from '@/components/shop/header';
import { SiteFooter } from '@/components/shop/footer';
import { CartDrawer } from '@/components/shop/cart-drawer';
import { RuoGate } from '@/components/shop/gate';
import { EmailCapture } from '@/components/shop/capture';
import { ChatWidget } from '@/components/shop/chat';
import { ReferralBar } from '@/components/shop/referral-bar';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, catalog, customer, jar] = await Promise.all([getSettings(), getCatalog(), getCustomer(), cookies()]);
  const client = catalog.map(toClientProduct);
  const gateAccepted = jar.get('mt_ruo')?.value === '1';
  return (
    <ShopProvider catalog={client} config={await publicConfig(settings)} signedIn={!!customer}>
      <a href="#app" className="k-sr" style={{ position: 'absolute' }}>
        Skip to content
      </a>
      <aside className="notice" aria-label="Shop notice">
        <div className="wrap">
          <span className="ruo">
            <b>Laboratory research use only.</b> Not for human or veterinary use.
          </span>
          <span>
            {settings.announcement || (
              <>
                Free tracked delivery over {money(settings.shipping.freeOver)}
                {settings.chat.enabled && (
                  <>
                    {' · '}
                    <span className="sp">
                      <i />
                      24/7 support, instant replies
                    </span>
                  </>
                )}
              </>
            )}
          </span>
        </div>
      </aside>
      <SiteHeader />
      {settings.affiliates.enabled && <ReferralBar />}
      <main id="app">{children}</main>
      <SiteFooter settings={settings} catalog={client} />
      <CartDrawer />
      <MobileNav />
      <SearchOverlay />
      <EmailCapture />
      {settings.chat.enabled && <ChatWidget />}
      {!gateAccepted && <RuoGate storeName={settings.storeName} />}
      <noscript>
        <div className="wrap" style={{ padding: 12 }}>
          This shop needs JavaScript for the basket and checkout. <Link href="/contact">Contact us</Link> if you need help.
        </div>
      </noscript>
    </ShopProvider>
  );
}
