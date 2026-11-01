import Link from 'next/link';
import type { ClientProduct } from '@/lib/catalog-types';
import type { SiteSettings } from '@/lib/settings';
import { NewsForm } from './capture';
import { OpenChatButton } from './bits';

export function SiteFooter({ settings, catalog }: { settings: SiteSettings; catalog: ClientProduct[] }) {
  const co = settings.company;
  return (
    <footer>
      <div className="wrap">
        <div className="fg">
          <div>
            <Link className="logo" href="/" style={{ color: 'var(--crema)' }}>
              MT2 LAB <small>UK</small>
            </Link>
            <p style={{ marginTop: 14, maxWidth: '40ch', fontSize: 14.5 }}>
              Melanotan I and II for laboratory research, with an HPLC and mass spec report for every lot. Shipped from the UK.
            </p>
            <NewsForm />
            {settings.chat.enabled && (
              <div className="care">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <i />
                  Support 24/7, instant replies
                </span>
                <OpenChatButton>Chat now</OpenChatButton>
              </div>
            )}
          </div>
          <div>
            <h2>Shop</h2>
            {catalog.map((p) => (
              <Link key={p.id} href={p.href}>
                {p.kind === 'bundle' ? p.name : p.name}
              </Link>
            ))}
            <Link href="/shop">All products</Link>
          </div>
          <div>
            <h2>Learn</h2>
            <Link href="/science">The science</Link>
            <Link href="/science#regulators">What regulators say</Link>
            <Link href="/lot-reports">Lot reports</Link>
            <Link href="/about">About us</Link>
            {settings.affiliates.enabled && <Link href="/affiliates">Affiliate programme</Link>}
          </div>
          <div>
            <h2>Help</h2>
            <Link href="/help">Help centre</Link>
            <Link href="/track">Track an order</Link>
            <Link href="/delivery">Delivery</Link>
            <Link href="/returns">Returns</Link>
            <Link href="/account">My account</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
        <div className="legal">
          <p>
            {settings.storeName} supplies Melanotan I and Melanotan II strictly for in vitro laboratory research. They are not medicines, are not licensed
            for human or veterinary use, and must not be injected, inhaled or applied to people or animals. Nothing on this site is medical advice. A tan
            is not sun protection.
          </p>
          <p>
            © {new Date().getFullYear()} {co.name} · Registered office {co.address} · Company number {co.number}
            {co.vatNumber ? ` · VAT ${co.vatNumber}` : ''}
            {settings.showSampleNotice ? ' · Lot data marked “Sample data” is placeholder content.' : ''}
          </p>
          <div className="flinks">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="/delivery">Delivery</Link>
            <Link href="/returns">Returns</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
