import type { Metadata } from 'next';
import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { getAffiliate } from '@/lib/affiliate-auth';
import { money } from '@/lib/money';
import { Faq, KitCrumbs } from '@/components/shop/trust';

export const metadata: Metadata = {
  title: 'Affiliate programme',
  description: 'Share MT2 Lab with your research audience. Your audience gets a discount with your code, and you earn commission on every order, paid monthly by bank transfer.',
  alternates: { canonical: '/affiliates' },
};

export default async function AffiliatesPage() {
  const [s, me] = await Promise.all([getSettings(), getAffiliate()]);
  const p = s.affiliates;
  const open = p.enabled && p.applicationsOpen;
  const schedule = p.payoutSchedule.charAt(0).toLowerCase() + p.payoutSchedule.slice(1);

  if (!p.enabled) {
    return (
      <div className="k-page">
        <div className="k-wrap k-narrow">
          <KitCrumbs items={[['Affiliate programme']]} />
          <h1 className="k-h1">Affiliate programme</h1>
          <p className="k-lede">The programme is closed at the moment. Existing affiliates can still sign in to see their sales and payouts.</p>
          <p style={{ marginTop: 22 }}>
            <Link className="k-btn" href={me ? '/affiliates/portal' : '/affiliates/login'}>
              {me ? 'Open your portal' : 'Affiliate sign in'}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="k-page">
      <div className="k-wrap">
        <KitCrumbs items={[['Affiliate programme']]} />
        <div className="k-about-hero">
          <div>
            <h1 className="k-h1">Affiliate programme</h1>
            <p className="k-lede">
              Share {s.storeName} with your research audience.{' '}
              {p.discountPct > 0 ? `They get ${p.discountPct}% off with your own code, and you earn` : 'You get your own code and earn'} {p.commissionPct}% of every
              order it brings in, paid {schedule}.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              {me ? (
                <Link className="k-btn" href="/affiliates/portal">
                  Open your portal
                </Link>
              ) : (
                <>
                  {open && (
                    <Link className="k-btn" href="/affiliates/apply">
                      Apply to join
                    </Link>
                  )}
                  <Link className={`k-btn${open ? ' ghost' : ''}`} href="/affiliates/login">
                    Affiliate sign in
                  </Link>
                </>
              )}
            </div>
            {!open && !me && (
              <p className="k-small" style={{ marginTop: 14 }}>
                We are not taking new applications right now. Check back soon.
              </p>
            )}
          </div>
          <div className="art">
            <img src="/img/duo.webp" alt="Melanotan I and Melanotan II vials" className="contain" />
          </div>
        </div>

        <div className="k-values four" style={{ marginTop: 56 }}>
          <div>
            <b>{p.commissionPct}% commission</b>
            <p>On the order value after discounts, excluding delivery. Every order placed with your code counts, not just the first.</p>
          </div>
          <div>
            <b>{p.discountPct > 0 ? `${p.discountPct}% off for your audience` : 'Your own code'}</b>
            <p>A code with your name on it, like SARAH10, and a link that shows it to everyone who follows it.</p>
          </div>
          <div>
            <b>Paid monthly</b>
            <p>
              By bank transfer once your balance reaches {money(p.minPayout)}. Commission is ready {p.holdDays} days after dispatch, once returns have settled.
            </p>
          </div>
          <div>
            <b>Live dashboard</b>
            <p>Visits, orders, commission and payouts in your own portal, updated as orders come in.</p>
          </div>
        </div>

        <h2 className="k-h2" style={{ marginTop: 56 }}>
          How it works
        </h2>
        <ol className="k-steps3">
          <li>
            <b>Apply</b>Tell us about your audience and how you would share us. We review every application by hand, usually within a few working days.
          </li>
          <li>
            <b>Share your code and link</b>Post your link or code with your content. Visitors from your link are offered your code; it works at checkout on any order.
          </li>
          <li>
            <b>Get paid</b>Watch orders arrive in your portal. Commission becomes ready to pay {p.holdDays} days after each order ships, and we pay it to your bank.
          </li>
        </ol>

        <div className="k-grid2" style={{ marginTop: 56, gap: 40, alignItems: 'start' }}>
          <div>
            <h2 className="k-h2" style={{ marginBottom: 12 }}>
              The rules, in short
            </h2>
            <p className="k-mute" style={{ margin: '0 0 14px', lineHeight: 1.7 }}>
              Our products are sold for laboratory research only. Everything you post about us has to say the same, or we close the account.
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
              <li>Present the products as research materials, and link to our lot reports and science page</li>
              <li>Never mention tanning, doses, injecting or any use in people or animals</li>
              <li>Say clearly that you are an affiliate, for example with #ad</li>
              <li>Nothing aimed at under 18s, no spam, no paid search ads on our name</li>
              <li>No orders with your own code</li>
            </ul>
            <Link className="k-link" href="/affiliates/terms" style={{ display: 'inline-block', marginTop: 14, fontSize: 14.5 }}>
              Read the full programme rules
            </Link>
          </div>
          <div>
            <h2 className="k-h2" style={{ marginBottom: 6 }}>
              Questions
            </h2>
            <Faq
              items={[
                [
                  'Who can join?',
                  'Science writers, educators, researchers and communities with an audience interested in peptide research. You must be 18 or over, and your audience should be in the UK, as we only deliver to UK addresses.',
                ],
                ['How are orders credited to me?', 'When a customer uses your code at checkout. Visitors who arrive through your link are shown your code and can add it in one tap.'],
                [
                  'When do I get paid?',
                  `Commission becomes ready to pay ${p.holdDays} days after the order is dispatched, so returns can settle first. We pay ${schedule}, once your balance reaches ${money(p.minPayout)}.`,
                ],
                ['What if an order is refunded?', 'Commission follows the order: a partial refund reduces it and a cancellation or full refund removes it.'],
                ['Can I see who ordered?', 'You see the date, value and commission of every order. Customers’ names and contact details are never shared.'],
                ['Do I need to be a company?', 'No. Individuals are welcome. You are responsible for declaring your commission for tax.'],
              ]}
            />
          </div>
        </div>

        {open && !me && (
          <div className="k-card" style={{ marginTop: 56, display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <b className="k-h3">Ready to apply?</b>
              <p className="k-small" style={{ margin: '4px 0 0' }}>
                It takes about two minutes.
              </p>
            </div>
            <Link className="k-btn" href="/affiliates/apply">
              Apply to join
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
