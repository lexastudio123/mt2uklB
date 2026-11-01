// Legal page templates. Business details come from Admin › Settings.
// Have a solicitor review them, then tick "Legal pages reviewed" in Settings to hide the template note.
import type { SiteSettings } from '@/lib/settings';

export type LegalKind = 'terms' | 'privacy' | 'cookies';
export type LegalSection = [string, React.ReactNode];

export function legal(kind: LegalKind, s: SiteSettings): { title: string; sections: LegalSection[] } {
  const L = s.company;
  const ruo = 'All products are sold for in vitro laboratory research only and are not for human or veterinary use.';
  if (kind === 'terms') {
    return {
      title: 'Terms and conditions',
      sections: [
        ['About us', `${s.storeName} is a trading name of ${L.name}, registered in ${L.jurisdiction} under company number ${L.number}, with its registered office at ${L.address}. Contact us at ${s.supportEmail}.`],
        ['Who can buy', `You must be ${s.checkout.minAge} or over to order. ${ruo} By ordering you confirm the products will not be administered to people or animals.`],
        [
          'Orders',
          'Your order is an offer to buy. A contract forms when we email to confirm payment. We may refuse or cancel an order, for example if an item is out of stock, a price was shown in error, or we believe the products will not be used for research, and we refund any payment in full.',
        ],
        [
          'Prices and payment',
          `Prices are shown in pounds sterling${s.company.vatNumber ? ' and include VAT' : ''}. Delivery charges are shown before you pay. Card payments are taken when you place your order. Bank transfer orders are reserved for ${s.payments.bankTransfer.expiryDays} days and cancelled if payment has not arrived by then.`,
        ],
        ['Delivery', 'Delivery estimates are shown at checkout and on our delivery page. Risk passes to you on delivery.'],
        ['Cancellations and returns', `Sealed, unopened vials can be returned within ${s.returnsDays} days of delivery as set out in our returns policy. Your statutory rights are not affected.`],
        [
          'Product information',
          'Melanotan I and Melanotan II are supplied for in vitro laboratory research only. They are not medicines, are not licensed for human or veterinary use, and must not be administered to people or animals. Information on this site describes published research and is not medical advice.',
        ],
        [
          'Liability',
          'Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or any other liability that cannot be limited by law. Otherwise our total liability is limited to the price paid for the order. We are not responsible for any use of the products other than lawful laboratory research.',
        ],
        ['Law', `These terms are governed by the law of ${L.jurisdiction}.`],
      ],
    };
  }
  if (kind === 'privacy') {
    return {
      title: 'Privacy notice',
      sections: [
        ['Who we are', `${L.name} is the controller of your personal data. Contact ${s.supportEmail} with any privacy question.`],
        [
          'What we collect',
          <ul key="c">
            <li>Contact and delivery details you give us at checkout</li>
            <li>Order history and messages you send us, including chat transcripts</li>
            <li>Payment confirmations from our payment provider. We never see or store full card numbers.</li>
            <li>Basic technical data needed to run the site securely, such as your IP address</li>
            <li>If you join our affiliate programme: your contact details, the channels you promote us on, and the bank details we pay commission to</li>
          </ul>,
        ],
        [
          'Why we use it',
          <table key="t">
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Lawful basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Processing and delivering orders</td>
                <td>Contract</td>
              </tr>
              <tr>
                <td>Customer support, including the chat assistant</td>
                <td>Contract and legitimate interests</td>
              </tr>
              <tr>
                <td>Marketing emails you opted in to</td>
                <td>Consent, which you can withdraw at any time</td>
              </tr>
              <tr>
                <td>Running the affiliate programme and paying commission</td>
                <td>Contract</td>
              </tr>
              <tr>
                <td>Fraud prevention and record keeping</td>
                <td>Legal obligation and legitimate interests</td>
              </tr>
            </tbody>
          </table>,
        ],
        ['Who we share it with', 'Our payment provider, delivery partners, email provider, hosting provider and, if you use the chat assistant, our AI provider, each under a written contract. We do not sell personal data. Affiliates who refer you see the date and value of your order, never your name or contact details.'],
        ['How long we keep it', 'Order records and affiliate payment records for 6 years for tax purposes. Chat transcripts for 12 months. Marketing preferences until you unsubscribe.'],
        [
          'Your rights',
          'You can ask for a copy of your data, ask us to correct or delete it, object to processing, or withdraw consent. You can also complain to the Information Commissioner’s Office (ico.org.uk).',
        ],
        ['International transfers', 'Where a provider stores data outside the UK, we use approved safeguards such as the UK International Data Transfer Agreement or standard contractual clauses.'],
      ],
    };
  }
  return {
    title: 'Cookies',
    sections: [
      ['Our approach', 'We use only what the site needs to work. There are no advertising or tracking cookies.'],
      [
        'What is stored',
        <table key="t">
          <thead>
            <tr>
              <th>Name</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basket</td>
              <td>Remembers what is in your basket, any discount code you add and your checkout details on this device</td>
              <td>Until cleared</td>
            </tr>
            <tr>
              <td>mt_ruo</td>
              <td>Remembers that you confirmed the research use notice</td>
              <td>12 months</td>
            </tr>
            <tr>
              <td>mt_sid</td>
              <td>Keeps you signed in to your account</td>
              <td>30 days or until you sign out</td>
            </tr>
            <tr>
              <td>mt_aff</td>
              <td>Keeps affiliates signed in to the affiliate portal</td>
              <td>14 days or until you sign out</td>
            </tr>
          </tbody>
        </table>,
      ],
      [
        'Affiliate links',
        'Following an affiliate link does not set a cookie. The page offers you the affiliate’s code, and only if you choose to add it is it kept with your basket. We count visits from each link without storing your IP address.',
      ],
      ['Analytics', 'If we add analytics, we will use a privacy friendly tool that does not set tracking cookies, and update this page first.'],
      ['Managing storage', 'You can clear site data in your browser settings at any time. The basket will empty if you do.'],
    ],
  };
}
