import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { KitCrumbs } from '@/components/shop/trust';
import { OpenChatButton } from '@/components/shop/bits';
import { TrackForm } from './form';

export const metadata: Metadata = { title: 'Track your order', description: 'Check your order status with your order number and email or postcode.' };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="k-page">
      <div className="k-wrap k-narrow">
        <KitCrumbs items={[['Track your order']]} />
        <h1 className="k-h1">Track your order</h1>
        <p className="k-lede">Enter your order number and the email or postcode you used. No account needed.</p>
        <TrackForm order={(sp.order ?? '').toUpperCase().slice(0, 12)} />
        <p className="k-small" style={{ marginTop: 20 }}>
          Order numbers start with MT and are in your confirmation email. Can&apos;t find it?{' '}
          {s.chat.enabled ? (
            <OpenChatButton className="k-link" style={{ fontSize: 13 }}>
              Ask the assistant
            </OpenChatButton>
          ) : (
            <a className="k-link" href="/contact">
              Contact us
            </a>
          )}
          .
        </p>
      </div>
    </div>
  );
}
