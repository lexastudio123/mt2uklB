// Help centre, returns and about page copy. Prices, thresholds and policies come from
// the catalogue and Admin › Settings so the words never drift from what the shop does.
import { perVial, type ClientProduct } from '@/lib/catalog-types';
import type { SiteSettings } from '@/lib/settings';
import { m2, money } from '@/lib/money';
import { cutoffLabel } from '@/lib/eta';

export type HelpCategory = { cat: string; items: [string, string][] };

function payText(s: SiteSettings, card: boolean, bank: boolean) {
  if (card && bank) return 'by card (Visa, Mastercard, American Express, Apple Pay or Google Pay) or by bank transfer';
  if (card) return 'by card (Visa, Mastercard, American Express, Apple Pay or Google Pay)';
  if (bank) return 'by bank transfer';
  return 'with the payment options shown at checkout';
}

export function helpContent(catalog: ClientProduct[], s: SiteSettings, pay: { card: boolean; bank: boolean }): HelpCategory[] {
  const mt2 = catalog.find((p) => p.code === 'MT2');
  const mt1 = catalog.find((p) => p.code === 'MT1');
  const methods = s.shipping.methods.filter((m) => m.active);
  const std = methods.find((m) => m.freeOver) ?? methods[0];
  const exp = methods.find((m) => m !== std);
  const cut = cutoffLabel(s.shipping.cutoffHour);
  const ukOnly = s.shipping.countries.length === 1 && s.shipping.countries[0] === 'United Kingdom';
  const savings = [mt2, mt1]
    .filter((p): p is ClientProduct => !!p && p.packs.length > 1)
    .map((p) => `${p.name} is ${m2(perVial(p, p.packs[0]))} a vial singly and ${m2(perVial(p, p.packs[p.packs.length - 1]))} a vial in the ${p.packs[p.packs.length - 1].qty} pack.`)
    .join(' ');

  const cats: HelpCategory[] = [
    {
      cat: 'Orders',
      items: [
        ['How do I order?', `Choose a product and pack size, then check out ${payText(s, pay.card, pay.bank)}. Guest checkout works; an account lets you track orders and reorder in one tap.`],
        ['How do pack savings work?', `Each pack has a fixed price that works out cheaper per vial. ${savings}`],
        ['Can I change or cancel an order?', 'Message us within an hour and we will change or cancel it before it is packed.'],
        ['Do you have discount codes?', `New customers get ${s.marketing.welcomePct}% off a first order with code ${s.marketing.welcomeCode}.`],
      ],
    },
    {
      cat: 'Delivery',
      items: [
        ['When will my order ship?', `Orders placed before ${cut} UK time on a working day are dispatched the same day. Later orders go out the next working day.`],
        [
          'How much is delivery?',
          `${std ? `${std.name} is ${m2(std.price)}${std.freeOver ? `, free on orders over ${money(s.shipping.freeOver)}` : ''}.` : ''}${exp ? ` ${exp.name}${exp.note ? ` (${exp.note.charAt(0).toLowerCase() + exp.note.slice(1)})` : ''} is ${m2(exp.price)}.` : ''}`,
        ],
        ['Is the parcel discreet?', 'Yes. Vials ship in a plain padded envelope with no product names on the outside.'],
        ['Do you ship outside the UK?', ukOnly ? 'No. We currently ship to UK addresses only.' : `We ship to ${s.shipping.countries.join(', ')}.`],
      ],
    },
    {
      cat: 'Returns',
      items: [
        ['What is your returns policy?', `Sealed, unopened vials can be returned within ${s.returnsDays} days of delivery for a refund.`],
        ['What if my vial does not match its report?', 'If an independent test of a sealed vial does not match our published lot report, send us the result and we refund the order in full.'],
        ['My order arrived damaged', 'Send a photo and your order number through the contact form within 7 days and we will replace it free of charge.'],
      ],
    },
    {
      cat: 'Products',
      items: [
        [
          'What is the difference between MT1 and MT2?',
          'Melanotan I (afamelanotide) acts mainly on the skin pigment receptor and is licensed elsewhere as Scenesse for a rare light sensitivity condition. Melanotan II acts on several receptors and is not licensed anywhere.',
        ],
        ['How is each lot tested?', 'An independent lab tests every lot for purity by HPLC, identity by mass spectrometry, peptide content and endotoxin. Reports are on the lot reports page.'],
        ['How should vials be stored?', 'Keep sealed vials frozen at minus 20°C, away from light.'],
        ['Is water included?', 'No. Vials contain lyophilised peptide only.'],
        ['Can you advise on doses or use?', 'No. Our vials are for laboratory research only, and we do not give dosing, reconstitution or usage advice.'],
      ],
    },
    {
      cat: 'Payments',
      items: [
        [
          'How can I pay?',
          `You can pay ${payText(s, pay.card, pay.bank)}.${pay.card ? ' Card details go straight to our payment provider; we never see full card numbers.' : ''}`,
        ],
        ...(pay.bank
          ? ([
              [
                'How does paying by bank transfer work?',
                `Place your order and choose bank transfer. We show our bank details and your reference on screen and by email. Your items are reserved for ${s.payments.bankTransfer.expiryDays} days and ship as soon as the payment arrives.`,
              ],
            ] as [string, string][])
          : []),
        ['Is VAT included?', s.company.vatNumber ? 'Yes. All prices include UK VAT.' : 'Prices are the final amount you pay. Nothing is added at checkout apart from delivery.'],
      ],
    },
    {
      cat: 'Account',
      items: [
        ['Do I need an account?', 'No. Guest checkout works for every order.'],
        ['I forgot my password', 'Use the reset link on the sign in page and we will email you a secure link.'],
      ],
    },
  ];
  return cats;
}

export const allHelp = (cats: HelpCategory[]) => cats.flatMap((c) => c.items.map(([q, a]) => ({ cat: c.cat, q, a })));

export function returnsContent(s: SiteSettings) {
  return {
    lede: `Sealed, unopened vials can be returned within ${s.returnsDays} days of delivery. If an independent test of a sealed vial does not match our published lot report, we refund the order in full.`,
    ok: [`Sealed, unopened vials within ${s.returnsDays} days`, 'Damaged or faulty items', 'Wrong items sent by us', 'Any sealed vial whose independent test does not match our lot report'],
    no: ['Opened or reconstituted vials, unless faulty', `Items returned after ${s.returnsDays} days`],
    faq: [
      ['How long do refunds take?', 'Within 3 working days of receiving the return, to your original payment method.'],
      ['Who pays return postage?', 'We send a prepaid label for faulty, damaged or incorrect items. Other returns are at your cost.'],
    ] as [string, string][],
  };
}

export const ABOUT = {
  title: 'Melanotan, documented',
  lede: 'MT2 Lab is a UK supplier of Melanotan I and Melanotan II for laboratory research. We test every lot, publish every report, and are straight about what these compounds are.',
  values: [
    ['Every lot tested', 'HPLC, mass spec, content and endotoxin, by an independent lab.'],
    ['Reports in public', 'The report for the lot you receive is online before you buy.'],
    ['Plain and fast', 'Same day dispatch, tracked delivery, plain envelope.'],
    ['Real answers', 'Instant replies from our assistant at any hour, and a team behind it.'],
  ] as [string, string][],
  story: [
    ['Why we started', 'Melanotan is widely sold with no way to check what is in the vial. We built MT2 Lab around one idea: show the test result for the exact lot before anyone orders.'],
    ['What we will not do', 'We do not give dosing or usage advice, we do not make health or beauty claims, and we are clear that a tan is not sun protection.'],
  ] as [string, string][],
};
