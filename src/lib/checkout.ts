import 'server-only';
import { z } from 'zod';
import type { Customer } from '@prisma/client';
import { db } from './db';
import { getCatalog, bySlug } from './catalog';
import { MAX_LINE_QTY, deliveryFor, priceCart, type CartLine } from './cart-math';
import { activeMethods, bankTransferAvailable, cardPaymentsAvailable, getSettings, type SiteSettings } from './settings';
import { arrival } from './eta';
import { EMAIL_RE, UK_POSTCODE_RE, formatPostcode } from './site';
import { newAccessToken, newOrderNumber, newReferralCode } from './ids';
import { OrderError, addEvent, cancelOrder, expireStaleOrders, markPaid, notifyTeamNewOrder, reserveStock, sendOrderEmail } from './orders';
import { createCheckoutSession } from './payments/stripe';
import { newToken } from './security';
import { m2, money } from './money';

// ───────────── Discount and referral codes ─────────────

export type CodeResult =
  | { ok: true; code: string; kind: 'discount' | 'referral'; amount: number; label: string; referrerId?: string }
  | { ok: false; code: string; message: string };

async function hasPriorOrders(email: string): Promise<boolean> {
  return (await db.order.count({ where: { email: email.toLowerCase(), status: { not: 'cancelled' } } })) > 0;
}

export async function evaluateCode(
  raw: string,
  ctx: { subtotal: number; email?: string | null; settings: SiteSettings },
): Promise<CodeResult | null> {
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  const now = new Date();
  const dc = await db.discountCode.findUnique({ where: { code } });
  if (dc) {
    const no = (message: string): CodeResult => ({ ok: false, code, message });
    if (!dc.active || (dc.startsAt && dc.startsAt > now)) return no('That code is not active.');
    if (dc.endsAt && dc.endsAt < now) return no('That code has expired.');
    if (dc.maxUses != null && dc.usedCount >= dc.maxUses) return no('That code has been fully used.');
    if (ctx.subtotal < dc.minSubtotal) return no(`Spend ${money(dc.minSubtotal)} or more to use this code.`);
    if (dc.firstOrderOnly && ctx.email && (await hasPriorOrders(ctx.email))) return no('That code is for a first order only.');
    const amount = dc.kind === 'fixed' ? Math.min(dc.value, ctx.subtotal) : Math.round((ctx.subtotal * dc.value) / 100);
    return { ok: true, code, kind: 'discount', amount, label: dc.kind === 'fixed' ? `${money(dc.value)} off` : `${dc.value}% off` };
  }
  if (ctx.settings.referral.enabled) {
    const ref = await db.customer.findUnique({ where: { referralCode: code }, select: { id: true, email: true, blocked: true } });
    if (ref && !ref.blocked) {
      if (ctx.email && ref.email === ctx.email.toLowerCase()) return { ok: false, code, message: 'You cannot use your own referral code.' };
      if (ctx.email && (await hasPriorOrders(ctx.email))) return { ok: false, code, message: 'Referral codes are for a first order only.' };
      const pct = ctx.settings.referral.discountPct;
      return { ok: true, code, kind: 'referral', amount: Math.round((ctx.subtotal * pct) / 100), label: `${pct}% off with a friend's code`, referrerId: ref.id };
    }
  }
  return { ok: false, code, message: `That code is not valid. Check the spelling, or try ${ctx.settings.marketing.welcomeCode} on a first order.` };
}

// ───────────── Quote ─────────────

export type QuoteInput = { lines: CartLine[]; shippingMethodId?: string | null; code?: string | null; email?: string | null; useCredit?: boolean };

export async function quote(input: QuoteInput, customer: Customer | null) {
  const [catalog, settings] = await Promise.all([getCatalog(), getSettings()]);
  const priced = priceCart(catalog, input.lines);
  const del = deliveryFor(activeMethods(settings), input.shippingMethodId, priced.subtotal, settings.shipping.freeOver, priced.lines.length > 0);

  // Stock: bundles draw on their components.
  const need = new Map<string, number>();
  for (const l of priced.lines) {
    const p = bySlug(catalog, l.slug);
    if (!p) continue;
    if (p.kind === 'bundle') for (const c of p.components) need.set(c.slug, (need.get(c.slug) ?? 0) + c.qty * l.packQty * l.qty);
    else need.set(p.slug, (need.get(p.slug) ?? 0) + l.packQty * l.qty);
  }
  const stockIssues: string[] = [];
  for (const [slug, n] of need) {
    const p = bySlug(catalog, slug);
    if (p && p.stockUnits !== null && n > p.stockUnits) {
      stockIssues.push(p.stockUnits > 0 ? `Only ${p.stockUnits} ${p.stockUnits === 1 ? 'vial' : 'vials'} of ${p.name} left.` : `${p.name} is out of stock.`);
    }
  }

  const email = input.email || customer?.email || null;
  const code = input.code ? await evaluateCode(input.code, { subtotal: priced.subtotal, email, settings }) : null;
  const discount = code?.ok ? Math.min(code.amount, priced.subtotal) : 0;
  const beforeCredit = priced.subtotal - discount + del.price;
  const credit = input.useCredit && customer ? Math.min(customer.creditPence, beforeCredit) : 0;
  return {
    lines: priced.lines,
    invalid: priced.invalid,
    count: priced.count,
    subtotal: priced.subtotal,
    full: priced.full,
    method: del.method,
    shipping: del.price,
    freeShip: del.free,
    code,
    discount,
    credit,
    availableCredit: customer?.creditPence ?? 0,
    total: Math.max(0, beforeCredit - credit),
    stockIssues,
  };
}
export type Quote = Awaited<ReturnType<typeof quote>>;

// ───────────── Place an order ─────────────

const opt = (max: number) => z.string().trim().max(max).optional().default('');

export const checkoutSchema = z.object({
  lines: z.array(z.object({ packId: z.string().min(1).max(60), qty: z.number().int().min(1).max(MAX_LINE_QTY) })).min(1, 'Your basket is empty').max(30),
  email: z.string().trim().toLowerCase().max(200).regex(EMAIL_RE, 'Enter an email address like name@example.com'),
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: opt(40).refine((v) => !v || /^[+\d][\d\s()-]{6,}$/.test(v), 'Enter a phone number with digits only'),
  country: z.string().trim().max(60),
  addr1: z.string().trim().min(3, 'Enter your address').max(150),
  addr2: opt(150),
  city: z.string().trim().min(2, 'Enter your town or city').max(80),
  post: z.string().trim().min(2, 'Enter your postcode').max(12),
  billSame: z.boolean().default(true),
  bill1: opt(150),
  billCity: opt(80),
  billPost: opt(12),
  shippingMethodId: z.string().max(40),
  paymentMethod: z.enum(['card', 'bank_transfer']),
  code: opt(40),
  useCredit: z.boolean().optional().default(false),
  news: z.boolean().optional().default(false),
  ruo: z.boolean().refine((v) => v === true, 'Tick to confirm before placing your order'),
  note: opt(500),
});

export type PlaceResult = { ok: true; redirect: string } | { ok: false; error: string; field?: string };

export async function placeOrder(raw: unknown, ctx: { customer: Customer | null; ip: string; userAgent: string | null }): Promise<PlaceResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message || 'Check your details and try again', field: String(issue?.path?.[0] ?? '') };
  }
  const d = parsed.data;
  const settings = await getSettings();

  if (!settings.shipping.countries.includes(d.country)) return { ok: false, error: `We deliver to ${settings.shipping.countries.join(', ')} only.`, field: 'country' };
  if (d.country === 'United Kingdom' && !UK_POSTCODE_RE.test(d.post)) return { ok: false, error: 'Enter a UK postcode like SW1A 1AA', field: 'post' };
  if (!d.billSame && (!d.bill1 || !d.billCity || !d.billPost)) return { ok: false, error: 'Add your billing address, or tick “same as delivery”', field: 'bill1' };

  await expireStaleOrders();
  const q = await quote({ lines: d.lines, shippingMethodId: d.shippingMethodId, code: d.code, email: d.email, useCredit: d.useCredit }, ctx.customer);
  if (q.invalid.length) return { ok: false, error: 'Some items in your basket are no longer available. Please check your basket.' };
  if (!q.lines.length || !q.method) return { ok: false, error: 'Your basket is empty.' };
  if (q.stockIssues.length) return { ok: false, error: q.stockIssues.join(' ') + ' Please update your basket.' };
  if (d.code && q.code && !q.code.ok) return { ok: false, error: q.code.message, field: 'code' };
  if (q.total > 0) {
    const available = d.paymentMethod === 'card' ? cardPaymentsAvailable(settings) : bankTransferAvailable(settings);
    if (!available) return { ok: false, error: 'That payment method is not available right now. Please choose another.', field: 'paymentMethod' };
  }

  const [etaFrom, etaTo] = arrival({ cutoffHour: settings.shipping.cutoffHour, closedDates: settings.shipping.closedDates }, q.method);
  const number = await newOrderNumber();
  const accessToken = newAccessToken();
  const referralCode = ctx.customer ? null : await newReferralCode(d.name);
  const code = q.code?.ok ? q.code : null;
  const free = q.total === 0;

  let orderId: string;
  try {
    orderId = await db.$transaction(async (tx) => {
      let customerId = ctx.customer?.id ?? null;
      if (!customerId) {
        const existing = await tx.customer.findUnique({ where: { email: d.email } });
        if (existing) customerId = existing.id;
        else {
          const c = await tx.customer.create({
            data: { email: d.email, name: d.name, phone: d.phone || null, referralCode: referralCode!, marketingOptIn: d.news },
          });
          customerId = c.id;
        }
      }
      if (code?.kind === 'referral' && code.referrerId && code.referrerId !== customerId) {
        await tx.customer.updateMany({ where: { id: customerId, referredById: null }, data: { referredById: code.referrerId } });
      }

      const o = await tx.order.create({
        data: {
          number,
          accessToken,
          customerId,
          referrerId: code?.kind === 'referral' ? code.referrerId ?? null : null,
          email: d.email,
          name: d.name,
          phone: d.phone || null,
          shipLine1: d.addr1,
          shipLine2: d.addr2 || null,
          shipCity: d.city,
          shipPostcode: d.country === 'United Kingdom' ? formatPostcode(d.post) : d.post,
          shipCountry: d.country,
          billSame: d.billSame,
          billLine1: d.billSame ? null : d.bill1,
          billCity: d.billSame ? null : d.billCity,
          billPostcode: d.billSame ? null : d.billPost.toUpperCase(),
          status: free ? 'paid' : 'awaiting_payment',
          paymentMethod: free ? 'credit' : d.paymentMethod,
          paymentStatus: free ? 'paid' : 'unpaid',
          paymentDetail: free ? 'Store credit' : d.paymentMethod === 'bank_transfer' ? 'Bank transfer' : null,
          paidAt: free ? new Date() : null,
          subtotal: q.subtotal,
          discount: q.discount,
          credit: q.credit,
          shipping: q.shipping,
          total: q.total,
          discountCode: code?.code ?? null,
          shippingMethodId: q.method!.id,
          shippingMethodName: q.method!.name,
          etaFrom,
          etaTo,
          customerNote: d.note || null,
          ruoConfirmed: true,
          marketingOptIn: d.news,
          placedSignedIn: !!ctx.customer,
          ip: ctx.ip,
          userAgent: ctx.userAgent?.slice(0, 300) ?? null,
          items: {
            create: q.lines.map((l) => ({
              productId: l.productId,
              packId: l.packId,
              productName: l.fullName,
              productCode: l.code,
              packLabel: l.meta,
              packQty: l.packQty,
              vials: l.vials,
              qty: l.qty,
              unitPrice: l.unitPrice,
              lineTotal: l.total,
              image: l.image,
            })),
          },
        },
        include: { items: true },
      });

      await reserveStock(tx, o.id, o.items);

      if (code?.kind === 'discount') {
        const dc = await tx.discountCode.findUnique({ where: { code: code.code } });
        if (!dc || (dc.maxUses != null && dc.usedCount >= dc.maxUses)) throw new OrderError('That discount code has just been used up. Remove it to continue.');
        await tx.discountCode.update({ where: { id: dc.id }, data: { usedCount: { increment: 1 } } });
      }
      if (q.credit > 0 && customerId) {
        const r = await tx.customer.updateMany({ where: { id: customerId, creditPence: { gte: q.credit } }, data: { creditPence: { decrement: q.credit } } });
        if (r.count !== 1) throw new OrderError('Your store credit balance has changed. Please review your order.');
        await tx.creditEntry.create({ data: { customerId, amount: -q.credit, reason: `Spent on order ${number}`, orderId: o.id } });
      }
      if (d.news) {
        await tx.subscriber.upsert({ where: { email: d.email }, update: { unsubscribedAt: null }, create: { email: d.email, source: 'checkout', token: newToken(18) } });
        await tx.customer.update({ where: { id: customerId! }, data: { marketingOptIn: true } });
      }
      if (ctx.customer && (await tx.address.count({ where: { customerId: ctx.customer.id } })) === 0) {
        await tx.address.create({
          data: { customerId: ctx.customer.id, name: d.name, line1: d.addr1, line2: d.addr2 || null, city: d.city, postcode: formatPostcode(d.post), country: d.country, phone: d.phone || null, isDefault: true },
        });
      }
      const how = free ? 'paid with store credit' : d.paymentMethod === 'bank_transfer' ? 'to be paid by bank transfer' : 'card payment pending';
      await tx.orderEvent.create({ data: { orderId: o.id, type: 'created', message: `Order placed online, ${how}. Total ${m2(q.total)}.` } });
      return o.id;
    });
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message };
    throw e;
  }

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (free) {
    await sendOrderEmail(order, 'confirmed');
    await notifyTeamNewOrder(order);
    return { ok: true, redirect: `/order/${accessToken}` };
  }
  if (d.paymentMethod === 'bank_transfer') {
    await sendOrderEmail(order, 'received_bank');
    await notifyTeamNewOrder(order);
    return { ok: true, redirect: `/order/${accessToken}` };
  }
  const card = await startCardPayment(order.id);
  // If the payment page never opened, release the stock and any code or credit straight away;
  // the customer stays on checkout and can try again or choose bank transfer.
  if (!card.ok) await cancelOrder(order.id, { reason: 'the card payment page could not be opened', notify: false });
  return card;
}

/** Open a hosted card payment page for an unpaid order (first attempt or a retry). */
export async function startCardPayment(orderId: string): Promise<PlaceResult> {
  const settings = await getSettings();
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.paymentStatus !== 'unpaid' || order.status !== 'awaiting_payment') return { ok: true, redirect: `/order/${order.accessToken}` };
  if (!cardPaymentsAvailable(settings)) return { ok: false, error: 'Card payments are not available right now.' };
  try {
    const session = await createCheckoutSession(order, settings.storeName);
    await db.order.update({ where: { id: order.id }, data: { paymentRef: session.id, paymentMethod: 'card', paymentDetail: null } });
    await addEvent(order.id, 'payment', 'Customer sent to the secure card payment page');
    if (!session.url) throw new Error('No checkout URL returned');
    return { ok: true, redirect: session.url };
  } catch (e) {
    console.error('[checkout] card session failed', e);
    await addEvent(order.id, 'payment', `Card payment page could not be opened: ${e instanceof Error ? e.message : 'unknown error'}`);
    return { ok: false, error: 'Card payments are unavailable right now. Please try again in a moment, or pay by bank transfer.' };
  }
}

/** Switch an unpaid card order to bank transfer (customer changed their mind on the order page). */
export async function switchToBankTransfer(orderId: string): Promise<boolean> {
  const settings = await getSettings();
  if (!bankTransferAvailable(settings)) return false;
  const r = await db.order.updateMany({
    where: { id: orderId, status: 'awaiting_payment', paymentStatus: 'unpaid' },
    data: { paymentMethod: 'bank_transfer', paymentDetail: 'Bank transfer', paymentRef: null },
  });
  if (r.count !== 1) return false;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  await addEvent(orderId, 'payment', 'Customer switched to bank transfer');
  await sendOrderEmail(order, 'received_bank');
  await notifyTeamNewOrder(order);
  return true;
}

export { markPaid, cancelOrder };
