import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { money } from '@/lib/money';
import { KitCrumbs } from '@/components/shop/trust';

export const metadata: Metadata = {
  title: 'Affiliate programme rules',
  description: 'How the MT2 Lab affiliate programme works: commission, payouts, and how the products may be promoted.',
  alternates: { canonical: '/affiliates/terms' },
};

export default async function AffiliateTermsPage() {
  const s = await getSettings();
  const p = s.affiliates;
  const sections: [string, React.ReactNode][] = [
    [
      'Joining',
      <p key="j">
        Anyone 18 or over can apply. We approve applications at our discretion and may ask about your audience first. Give us accurate details and keep them up to
        date in the portal. One account per person or business.
      </p>,
    ],
    [
      'How you earn',
      <>
        <p>
          You earn the commission rate shown in your portal ({p.commissionPct}% unless we have agreed otherwise) on the value of each order placed with your code,
          after discounts and excluding delivery. Visitors who follow your link are shown your code; an order is credited to you when the code is used at checkout.
        </p>
        <p>
          There is no commission on your own orders, orders placed for you or your household, or orders we reasonably believe are fraudulent or breach these
          rules.
        </p>
      </>,
    ],
    [
      'Hold period and refunds',
      <p key="h">
        Commission is credited when an order is paid and becomes ready to pay {p.holdDays} days after the order is dispatched. If an order is refunded in part, the
        commission goes down to match; if it is cancelled or fully refunded, the commission is removed. If a refund happens after we have paid you, the amount is
        taken off your next payout.
      </p>,
    ],
    [
      'Payouts',
      <p key="p">
        We pay {p.payoutSchedule.charAt(0).toLowerCase() + p.payoutSchedule.slice(1)}, once your balance ready to pay reaches {money(p.minPayout)}; smaller balances
        roll over. Payouts go to the bank account in your portal only. You are responsible for declaring your commission for tax. We may ask you to confirm your
        identity or bank details before paying.
      </p>,
    ],
    [
      'How you may promote us',
      <>
        <p>
          Our products are sold for in vitro laboratory research only. They are not medicines and are not for human or veterinary use. Everything you publish about
          us must be consistent with that.
        </p>
        <ul>
          <li>Do not make or suggest any claim about use in people or animals: tanning, skin, weight, libido, dosing, injecting, nasal sprays, “before and after” content or anything similar.</li>
          <li>Do not make medical or health claims, or give or invite advice on using the products.</li>
          <li>Do not aim content at anyone under 18.</li>
          <li>Say clearly that you are an affiliate, for example with #ad or “affiliate link”, as UK advertising rules require.</li>
          <li>No spam or unsolicited messages, no fake reviews, and nothing that could make people think you are us.</li>
          <li>No paid search ads on our name or misspellings of it, and no coupon or voucher sites, unless we agree in writing.</li>
          <li>Do not use our name in a domain name, social handle or app name.</li>
        </ul>
      </>,
    ],
    [
      'Our name and content',
      <p key="c">
        While you are an affiliate you may use our product images, product descriptions and lot reports to promote us, unchanged. You may not edit them in a way that
        suggests use in people. We may ask you to change or remove content at any time, and you agree to do so promptly.
      </p>,
    ],
    [
      'Personal data',
      <p key="d">
        We hold your contact and bank details to run the programme and pay you, as set out in our <a href="/privacy">privacy notice</a>. You will see the date and value
        of orders credited to you, never customers&apos; names or contact details.
      </p>,
    ],
    [
      'Ending the arrangement',
      <p key="e">
        You can leave at any time by emailing {s.supportEmail}. We can pause or close an account at any time; if an account breaks these rules we may withhold
        commission on the orders affected. Commission earned fairly before an account closes is paid as normal.
      </p>,
    ],
    [
      'Changes',
      <p key="ch">
        We may change commission rates or these rules with 14 days&apos; notice by email. Changes never reduce commission already credited.
      </p>,
    ],
    [
      'Law',
      <p key="l">
        These rules are governed by the law of {s.company.jurisdiction}. {s.company.name} runs the programme.
      </p>,
    ],
  ];
  const anchor = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <div className="k-page">
      <div className="k-wrap">
        <KitCrumbs items={[['Affiliate programme', '/affiliates'], ['Programme rules']]} />
        <div className="k-legal">
          <h1 className="k-h1">Affiliate programme rules</h1>
          {!s.legalReviewed && <div className="k-note" style={{ margin: '20px 0 6px' }}>Template. Have a solicitor review and complete it before launch.</div>}
          <nav className="k-toc" aria-label="Sections">
            {sections.map(([h]) => (
              <a key={h} href={`#${anchor(h)}`}>
                {h}
              </a>
            ))}
          </nav>
          {sections.map(([h, body]) => (
            <section key={h}>
              <h2 id={anchor(h)}>{h}</h2>
              {body}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
