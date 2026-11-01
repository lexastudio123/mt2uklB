import type { Metadata } from 'next';
import Link from 'next/link';
import { getCatalog, toClientProduct } from '@/lib/catalog';
import { bankTransferAvailable, cardPaymentsAvailable, getSettings } from '@/lib/settings';
import { getCustomer } from '@/lib/auth';
import { TICKET_TOPICS } from '@/lib/tickets';
import { allHelp, helpContent } from '@/content/help';
import { CopyButton, OpenChatButton } from '@/components/shop/bits';
import { Faq, KitCrumbs } from '@/components/shop/trust';
import { ContactForm } from './form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Chat with our assistant 24/7, email the team, or send a message about an order, delivery, returns or products. We reply by email.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ order?: string; topic?: string }> }) {
  const sp = await searchParams;
  const [catalog, s, me] = await Promise.all([getCatalog(), getSettings(), getCustomer()]);
  const quick = allHelp(helpContent(catalog.map(toClientProduct), s, { card: cardPaymentsAvailable(s), bank: bankTransferAvailable(s) })).slice(0, 5);
  return (
    <div className="k-page">
      <div className="k-wrap" style={{ maxWidth: 1080 }}>
        <KitCrumbs items={[['Contact']]} />
        <h1 className="k-h1">{s.chat.enabled ? "We're here 24/7" : 'Contact us'}</h1>
        <p className="k-lede">
          {s.chat.enabled
            ? "Chat with our assistant for an instant answer at any hour. For anything it can't sort, send a message and our team picks it up."
            : 'Send a message and our team replies by email, usually within a few hours.'}
        </p>
        <div className="k-grid3" style={{ marginTop: 26 }}>
          {s.chat.enabled && (
            <div className="k-card">
              <b className="k-h3">Live chat</b>
              <p className="k-small" style={{ margin: '6px 0 14px' }}>
                Instant replies, 24 hours a day, 7 days a week. Orders, delivery, returns and product details.
              </p>
              <OpenChatButton className="k-btn sm">Start a chat</OpenChatButton>
            </div>
          )}
          <div className="k-card">
            <b className="k-h3">Email</b>
            <p className="k-small" style={{ margin: '6px 0 10px' }}>
              Replies within a few hours, every day.
            </p>
            <div className="k-copy" style={{ fontWeight: 600, letterSpacing: 0, fontSize: 14 }}>
              <span>{s.supportEmail}</span>
              <CopyButton text={s.supportEmail} />
            </div>
          </div>
          <div className="k-card">
            <b className="k-h3">Track an order</b>
            <p className="k-small" style={{ margin: '6px 0 14px' }}>
              Live status with your order number. No login needed.
            </p>
            <Link className="k-btn sm ghost" href="/track">
              Track order
            </Link>
          </div>
        </div>
        <div className="k-grid2" style={{ marginTop: 36, gap: 40, alignItems: 'start' }}>
          <div>
            <h2 className="k-h2" style={{ marginBottom: 14 }}>
              Send a message
            </h2>
            <ContactForm
              topics={TICKET_TOPICS}
              defaults={{ name: me?.name ?? '', email: me?.email ?? '', order: (sp.order ?? '').slice(0, 12), topic: sp.order ? TICKET_TOPICS[0] : sp.topic ?? '' }}
            />
          </div>
          <div>
            <h2 className="k-h2" style={{ marginBottom: 6 }}>
              Quick answers
            </h2>
            <Faq items={quick.map((x) => [x.q, x.a])} />
            <Link className="k-link" href="/help" style={{ display: 'inline-block', marginTop: 14, fontSize: 14 }}>
              Visit the help centre
            </Link>
          </div>
        </div>
        <p className="k-small" style={{ marginTop: 30 }}>
          {s.company.name} · {s.company.address}
        </p>
      </div>
    </div>
  );
}
