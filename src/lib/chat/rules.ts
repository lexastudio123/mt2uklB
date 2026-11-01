// Chat assistant guard rails and built-in answers (used when no AI key is set, or as a fallback).
import { perVial, searchCatalog, type ClientProduct } from '../catalog-types';
import type { SiteSettings } from '../settings';
import { m2, money } from '../money';

export const REFUSAL =
  'Our vials are for laboratory research only, so I cannot help with doses or personal use. Regulators warn against using melanotan, and a tan is not sun protection. I can explain the background on MT1 and MT2, or help with an order.';

// Phrases that mean "how do I use this on a person". Checked before any model call.
const BLOCKED = ['dose', 'dosage', 'dosing', 'needle', 'loading dose', 'loading phase', 'maintenance dose', 'inject', 'pinning', 'how much should i', 'how much do i', 'protocol', 'should i take', 'sunbed', 'reconstitut', 'nasal spray', 'for tanning', 'tan faster', 'bac water', 'bacteriostatic water', 'syringe'];
const USAGE =
  /\b(is (it|this|they|that) safe|safe (for|to) (use|take|inject|humans?|people|me)|for (human|personal) use|on (humans?|people|myself|me|my skin|my body)|how often|how many (sprays?|clicks?|units?|mg|drops?)|how much (should|do|can|to)|reconstitut\w*|inject\w*|what dose|dos(e|es|ing|age)|cycles?|protocols?|how (to|do i|should i|do you) (use|take|administer)|for weight loss|to lose weight)\b/;
// Everyday shop questions that share words with the usage patterns ("how do I use a discount code").
const BENIGN = /\b(code|discount|voucher|promo|coupon|account|basket|cart|checkout|website|site|tracking|track|password|card|apple pay|google pay|bank transfer|chat)\b/;

const norm = (q: string) => ' ' + q.toLowerCase().replace(/[^a-z0-9@+\-\s]/g, ' ').replace(/\s+/g, ' ') + ' ';

/** True when the message asks about personal use or dosing and must be declined. */
export function mustDecline(q: string): boolean {
  const t = norm(q);
  if (BLOCKED.some((w) => t.includes(w))) return true;
  if (USAGE.test(t) && !BENIGN.test(t)) return true;
  return false;
}

const STOP = new Set(
  'a an and any are as at be can could do does did for from get got have has how i if in is it its me my of on or our please should so tell than that the their them there these they this to us was we what whats when where which who why will with would you your yours about between need needs want like know just really also much many more most some'.split(' '),
);

/** Rule-based reply, ported from the design preview. Links use site paths. */
export function ruleAnswer(
  raw: string,
  ctx: { catalog: ClientProduct[]; s: SiteSettings; card: boolean; bank: boolean; eta: string; help: { q: string; a: string }[] },
): string {
  const { catalog, s } = ctx;
  const t = norm(raw);
  const mt1 = catalog.find((p) => p.code === 'MT1');
  const mt2 = catalog.find((p) => p.code === 'MT2');
  const lots = catalog.filter((p) => p.kind === 'single').flatMap((p) => p.lots);

  if (/\b(mt1|mt2|melanotan i|melanotan ii|melanotan 1|melanotan 2|afamelanotide)\b.*\b(difference|differ|compare|vs|versus|or)\b|\b(difference|compare)\b.*\b(mt1|mt2|melanotan)\b/.test(t))
    return '**Melanotan I** (afamelanotide) is a linear 13 amino acid peptide that acts mainly on MC1, the skin pigment receptor. It is licensed in the EU (2014) and US (2019) as Scenesse, a prescription implant for erythropoietic protoporphyria. **Melanotan II** is a smaller cyclic peptide that acts on several melanocortin receptors and is not licensed anywhere. [MT1 and MT2 explained](/science)';
  if (/\b(side effects?|risks?|dangers?|dangerous|harmful|melanoma|moles?)\b/.test(t))
    return 'I cannot advise on effects in people. For background: regulators including the UK MHRA warn against using unlicensed melanotan, and published reports describe nausea, flushing, loss of appetite, darkening and new moles, and a small number of melanomas in users. Our vials are for laboratory research only. [What regulators say](/science#regulators)';
  if (mustDecline(raw)) return REFUSAL;
  if (/\b(best value|cheapest|value|pack|packs|bulk|per vial)\b/.test(t) && mt2 && mt2.packs.length > 1) {
    const last = mt2.packs[mt2.packs.length - 1];
    const mid = mt2.packs[Math.min(2, mt2.packs.length - 1)];
    let txt = `Melanotan II is ${m2(perVial(mt2, mt2.packs[0]))} a vial singly, ${m2(perVial(mt2, mid))} in the ${mid.qty} pack (${m2(mid.price)}) and ${m2(perVial(mt2, last))} in the ${last.qty} pack (${m2(last.price)}), the best value.`;
    if (mt1 && mt1.packs.length > 1) txt += ` Melanotan I goes from ${m2(perVial(mt1, mt1.packs[0]))} to ${m2(perVial(mt1, mt1.packs[mt1.packs.length - 1]))} a vial in the ${mt1.packs[mt1.packs.length - 1].qty} pack.`;
    return txt + ' Every vial in a pack is from the same lot.';
  }
  if (/\b(lot|report|reports|coa|purity|hplc|tested|check)\b/.test(t))
    return `Every lot is tested by an independent lab for purity (HPLC), identity (mass spec), content and endotoxin. Enter the lot number from your label on the [lot reports page](/lot-reports).${lots.length ? ` Lots shipping now: ${lots.map((l) => `${l.code} (${l.purity}%)`).join(' and ')}.` : ''}`;
  if (/\b(water|bacteriostatic)\b/.test(t)) return 'Vials contain lyophilised peptide only; no water is included and we do not sell it. We do not give reconstitution or usage advice.';
  if (/^ (hi|hello|hey|hiya|good (morning|evening|afternoon))\b/.test(t)) return 'Hello! I can help you find a product, check delivery dates or sort out an order. What do you need?';
  if (/\b(track|tracking|where is my order|where s my order|order status|parcel)\b/.test(t))
    return 'You can check any order on the [tracking page](/track) with your order number (it starts MT) and your email or postcode. If you have an account, [your orders](/account/orders) show live status too.';
  if (/\b(deliver\w*|shipping|ship|dispatch\w*|arrive|arrival|postage|courier)\b/.test(t))
    return `${ctx.eta} Free tracked delivery over ${money(s.shipping.freeOver)}. Full details are on the [delivery page](/delivery). Already ordered? [Track it here](/track).`;
  if (/\b(return\w*|refund\w*|exchange|wrong item|damaged|broken)\b/.test(t))
    return `Sealed vials can be returned within ${s.returnsDays} days. Start a return from the [returns page](/returns) or [message the team](/contact) with your order number.`;
  if (/\b(pay|payment|card|apple pay|visa|mastercard|amex|bank|paypal|klarna|crypto|bitcoin)\b/.test(t)) {
    const ways = [ctx.card ? 'by card (Visa, Mastercard, American Express, Apple Pay or Google Pay)' : '', ctx.bank ? 'by bank transfer' : ''].filter(Boolean).join(' or ');
    return `You can pay ${ways || 'with the options shown at checkout'}${/paypal|klarna|crypto|bitcoin/.test(t) ? '; other payment methods are not available at the moment' : ''}.${ctx.card ? ' Card details go straight to the payment provider.' : ''}`;
  }
  if (/\b(legal|illegal|law|laws|allowed|customs|import)\b/.test(t))
    return 'Rules for research materials differ from country to country. We cannot give legal advice, so please check the rules where you are before ordering. All products are sold for in vitro laboratory research only and are not for human or veterinary use.';
  if (/\b(discount|code|coupon|offer|promo|voucher)\b/.test(t))
    return `New customers get ${s.marketing.welcomePct}% off the first order with code **${s.marketing.welcomeCode}**. Pack savings are applied automatically in the basket.`;
  if (/\b(human|real person|someone|agent|call|speak|talk to)\b/.test(t)) return 'Send the team a message on the [contact page](/contact) and they reply by email, every day.';

  const kws = t.trim().split(' ').filter((w) => w && !STOP.has(w) && (w.length > 2 || /\d/.test(w)));
  if (kws.length) {
    const hits = kws.flatMap((w) => searchCatalog(catalog, w)).filter((p, i, a) => a.indexOf(p) === i);
    if (hits.length)
      return `Here's what I found:\n${hits
        .slice(0, 3)
        .map((h) => `- [${h.fullName}](${h.href}): from ${money(h.packs[0]?.price ?? 0)}`)
        .join('\n')}\nWant me to tell you more about one of these, or add one to your basket?`;
    const long = kws.filter((w) => w.length > 3);
    let best: { q: string; a: string } | null = null;
    let bestN = 0;
    for (const x of ctx.help) {
      const txt = (x.q + ' ' + x.a).toLowerCase();
      const n = long.filter((w) => txt.includes(w)).length;
      if (n > bestN) {
        bestN = n;
        best = x;
      }
    }
    if (best && bestN >= Math.min(2, long.length)) return best.a;
  }
  return 'I can help with products, delivery, returns, payments and orders. Could you tell me a bit more? You can also browse the [help centre](/help).';
}
