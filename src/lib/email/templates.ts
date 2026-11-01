import 'server-only';
import type { Affiliate, AffiliatePayout, Order, OrderItem, Ticket } from '@prisma/client';
import { m2 } from '../money';
import type { SiteSettings } from '../settings';
import { siteUrl } from '../site';

// Email-safe HTML: tables, inline styles, system fonts. Colours follow the site palette.
const C = { bean: '#16100C', crema: '#F4E9DC', milk: '#FAF4EC', oat: '#EFE4D6', ink: '#1A120D', umber: '#6B5646', copper: '#C8794A', copperHi: '#E9A877', line: '#E6DCCE' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const DISPLAY = "Impact,'Arial Narrow Bold','Arial Narrow',Arial,sans-serif";

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type Rendered = { subject: string; html: string };
type OrderFull = Order & { items: OrderItem[] };

const fdate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' }) : '';

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:${C.copper};border-radius:4px"><a href="${esc(href)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:15px;font-weight:700;color:#1A0E06;text-decoration:none">${esc(label)}</a></td></tr></table>`;
}

const h1 = (t: string) =>
  `<h1 style="margin:0 0 12px;font-family:${DISPLAY};font-size:34px;line-height:1;text-transform:uppercase;letter-spacing:.01em;color:${C.ink};font-weight:800">${t}</h1>`;
const p = (t: string, extra = '') => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.ink};${extra}">${t}</p>`;
const small = (t: string) => `<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:${C.umber}">${t}</p>`;

export function layout(s: SiteSettings, body: string, opts: { preheader?: string; unsubscribeUrl?: string } = {}): string {
  const tones = ['#F3D9C1', '#D9A57C', '#B27449', '#7F4A2A', '#4A2817']
    .map((c) => `<td style="height:6px;background:${c};font-size:0;line-height:0">&nbsp;</td>`)
    .join('');
  const co = s.company;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(s.storeName)}</title></head>
<body style="margin:0;padding:0;background:${C.milk};font-family:${FONT};color:${C.ink}">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(opts.preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.milk}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line};border-radius:6px;overflow:hidden">
<tr><td style="background:${C.bean};padding:20px 28px"><a href="${siteUrl()}" style="text-decoration:none"><span style="font-family:${DISPLAY};font-size:28px;font-weight:900;letter-spacing:.02em;color:${C.crema}">MT2 LAB</span>&nbsp;<span style="font-family:Menlo,monospace;font-size:11px;letter-spacing:.16em;color:${C.copperHi}">UK</span></a></td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tones}</tr></table></td></tr>
<tr><td style="padding:30px 28px 26px">${body}</td></tr>
<tr><td style="padding:18px 28px 22px;background:${C.oat};font-size:12px;line-height:1.6;color:${C.umber}">
Questions? Reply to this email or write to <a href="mailto:${esc(s.supportEmail)}" style="color:${C.umber}">${esc(s.supportEmail)}</a>.<br>
Products are sold for in vitro laboratory research only and are not for human or veterinary use.<br>
${esc(co.name)} · ${esc(co.address)} · Company number ${esc(co.number)}${co.vatNumber ? ` · VAT ${esc(co.vatNumber)}` : ''}
${opts.unsubscribeUrl ? `<br><a href="${esc(opts.unsubscribeUrl)}" style="color:${C.umber}">Unsubscribe</a>` : ''}
</td></tr></table></td></tr></table></body></html>`;
}

function itemsTable(o: OrderFull): string {
  const row = (l: string, r: string, opts: { bold?: boolean; muted?: boolean; top?: boolean } = {}) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:${opts.muted ? C.umber : C.ink};${opts.bold ? 'font-weight:700;font-size:16px;' : ''}${opts.top ? `border-top:1px solid ${C.line};padding-top:12px;` : ''}">${l}</td><td align="right" style="padding:6px 0;font-size:14px;white-space:nowrap;color:${opts.muted ? C.umber : C.ink};${opts.bold ? 'font-weight:700;font-size:16px;' : ''}${opts.top ? `border-top:1px solid ${C.line};padding-top:12px;` : ''}">${r}</td></tr>`;
  const lines = o.items
    .map(
      (i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px"><b>${esc(i.productName)}</b> × ${i.qty}<br><span style="color:${C.umber};font-size:13px">${esc(i.packLabel)}</span></td><td align="right" style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px;white-space:nowrap">${m2(i.lineTotal)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0">${lines}
${row('Subtotal', m2(o.subtotal), { top: false })}
${o.discount ? row(`Discount${o.discountCode ? ` (${esc(o.discountCode)})` : ''}`, '−' + m2(o.discount)) : ''}
${o.credit ? row('Store credit', '−' + m2(o.credit)) : ''}
${row(`Delivery (${esc(o.shippingMethodName)})`, o.shipping ? m2(o.shipping) : 'Free')}
${row('Total', m2(o.total), { bold: true, top: true })}</table>`;
}

function addressBlock(o: Order): string {
  const lines = [o.name, o.shipLine1, o.shipLine2, o.shipCity, o.shipPostcode, o.shipCountry].filter(Boolean).map(esc).join('<br>');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;background:${C.milk};border-radius:4px"><tr><td style="padding:14px 16px;font-size:14px;line-height:1.55"><span style="font-size:12px;color:${C.umber};text-transform:uppercase;letter-spacing:.08em">Delivering to</span><br>${lines}<br><span style="color:${C.umber}">${esc(o.shippingMethodName)}${o.etaFrom ? `, expected ${fdate(o.etaFrom)}${o.etaTo && +o.etaTo !== +o.etaFrom ? ` to ${fdate(o.etaTo)}` : ''}` : ''}</span></td></tr></table>`;
}

const orderLink = (o: Order) => `${siteUrl()}/order/${o.accessToken}`;

export function bankDetailsBlock(o: Order, s: SiteSettings): string {
  const b = s.payments.bankTransfer;
  const row = (k: string, v: string) =>
    v ? `<tr><td style="padding:5px 0;font-size:14px;color:${C.umber};width:42%">${k}</td><td style="padding:5px 0;font-size:15px;font-family:Menlo,monospace;font-weight:600">${esc(v)}</td></tr>` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:2px solid ${C.copper};border-radius:6px"><tr><td style="padding:16px 18px">
<span style="font-size:12px;color:${C.umber};text-transform:uppercase;letter-spacing:.08em">Pay by bank transfer</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
${row('Amount', m2(o.total))}${row('Account name', b.accountName)}${row('Sort code', b.sortCode)}${row('Account number', b.accountNumber)}${row('IBAN', b.iban)}${row('BIC', b.bic)}${row('Reference', o.number)}
</table></td></tr></table>`;
}

// ─────────────────── Customer emails ───────────────────

export function orderReceivedBank(o: OrderFull, s: SiteSettings): Rendered {
  const first = esc((o.name || '').split(' ')[0] || 'there');
  const body =
    h1('Order received') +
    p(`Thanks, ${first}. We have reserved your order <b>${esc(o.number)}</b>. To complete it, send a bank transfer for <b>${m2(o.total)}</b> using your order number as the reference.`) +
    bankDetailsBlock(o, s) +
    p(`We dispatch as soon as the payment arrives, usually within a working day. Unpaid orders are cancelled after ${s.payments.bankTransfer.expiryDays} days.`, `color:${C.umber};font-size:14px`) +
    itemsTable(o) +
    addressBlock(o) +
    button(orderLink(o), 'View your order');
  return { subject: `Order ${o.number} received: complete your bank transfer`, html: layout(s, body, { preheader: `Send ${m2(o.total)} with reference ${o.number} to complete your order.` }) };
}

export function orderConfirmed(o: OrderFull, s: SiteSettings): Rendered {
  const first = esc((o.name || '').split(' ')[0] || 'there');
  const body =
    h1('Order confirmed') +
    p(`Thanks, ${first}. Payment for order <b>${esc(o.number)}</b> is confirmed and we are getting it ready. You will get a tracking link as soon as it ships.`) +
    itemsTable(o) +
    addressBlock(o) +
    (o.paymentDetail ? small(`Paid with ${esc(o.paymentDetail)}.`) : '') +
    button(orderLink(o), 'View your order and invoice');
  return { subject: `Order ${o.number} confirmed`, html: layout(s, body, { preheader: `Payment received. We are packing order ${o.number}.` }) };
}

export function orderDispatched(o: OrderFull, s: SiteSettings): Rendered {
  const track = o.trackingNumber
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 10px;background:${C.milk};border-radius:4px"><tr><td style="padding:14px 16px;font-size:14px"><span style="font-size:12px;color:${C.umber};text-transform:uppercase;letter-spacing:.08em">${esc(o.trackingCarrier || 'Tracking number')}</span><br><span style="font-family:Menlo,monospace;font-size:17px;font-weight:600">${esc(o.trackingNumber)}</span></td></tr></table>`
    : '';
  const body =
    h1('On its way') +
    p(`Order <b>${esc(o.number)}</b> left us today in a plain padded envelope${o.etaFrom ? ` and should arrive <b>${fdate(o.etaFrom)}</b>` : ''}.`) +
    track +
    (o.trackingUrl ? button(o.trackingUrl, 'Track your parcel') : button(orderLink(o), 'View your order')) +
    itemsTable(o) +
    addressBlock(o);
  return { subject: `Order ${o.number} is on its way`, html: layout(s, body, { preheader: o.trackingNumber ? `Tracking number ${o.trackingNumber}` : 'Your order has been dispatched.' }) };
}

export function orderCancelled(o: OrderFull, s: SiteSettings, reason?: string): Rendered {
  const body =
    h1('Order cancelled') +
    p(`Order <b>${esc(o.number)}</b> has been cancelled${reason ? `: ${esc(reason)}` : '.'}`) +
    (o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded'
      ? p('Any payment you made will be refunded to the original payment method. We will email you when it is on its way.')
      : p('No payment was taken. If you still want the items, you are welcome to order again.')) +
    button(`${siteUrl()}/shop`, 'Visit the shop');
  return { subject: `Order ${o.number} cancelled`, html: layout(s, body) };
}

export function orderRefunded(o: OrderFull, s: SiteSettings, amount: number): Rendered {
  const body =
    h1('Refund issued') +
    p(`We have refunded <b>${m2(amount)}</b> for order <b>${esc(o.number)}</b>.`) +
    p(o.paymentMethod === 'card' ? 'Card refunds usually reach your account within 5 to 10 working days, depending on your bank.' : 'Bank transfer refunds usually arrive within 1 to 3 working days.', `color:${C.umber};font-size:14px`) +
    button(orderLink(o), 'View your order');
  return { subject: `Refund for order ${o.number}`, html: layout(s, body) };
}

export function passwordReset(s: SiteSettings, link: string): Rendered {
  const body = h1('Reset your password') + p('Use the button below to choose a new password. The link works once and expires in one hour.') + button(link, 'Choose a new password') + small('If you did not ask for this, you can ignore this email. Your password has not changed.');
  return { subject: `Reset your ${s.storeName} password`, html: layout(s, body) };
}

export function magicLink(s: SiteSettings, link: string): Rendered {
  const body = h1('Sign in') + p('Use the button below to sign in. The link works once and expires in 20 minutes.') + button(link, `Sign in to ${s.storeName}`) + small('If you did not ask for this, you can ignore this email.');
  return { subject: `Your ${s.storeName} sign in link`, html: layout(s, body) };
}

export function claimAccount(s: SiteSettings, link: string): Rendered {
  const body =
    h1('Finish your account') +
    p('You have ordered with us before as a guest. Use the button below to choose a password; your past orders will appear in your account.') +
    button(link, 'Choose a password') +
    small('The link works once and expires in 24 hours. If you did not ask for this, you can ignore this email.');
  return { subject: `Finish setting up your ${s.storeName} account`, html: layout(s, body) };
}

export function welcome(s: SiteSettings, name: string): Rendered {
  const body =
    h1(`Welcome${name ? ', ' + esc(name.split(' ')[0]) : ''}`) +
    p('Your account is ready. You can track orders, reorder in one tap and choose restock and new lot alerts.') +
    button(`${siteUrl()}/account`, 'Go to my account');
  return { subject: `Welcome to ${s.storeName}`, html: layout(s, body) };
}

export function ticketReceived(s: SiteSettings, t: Ticket): Rendered {
  const body =
    h1('We have your message') +
    p(`Thanks, ${esc(t.name.split(' ')[0] || 'there')}. Your reference is <b>${esc(t.ref)}</b>. The team replies by email, usually within a few hours.`) +
    button(`${siteUrl()}/support/${t.accessToken}`, 'View your conversation');
  return { subject: `We have your message (${t.ref})`, html: layout(s, body) };
}

export function ticketReply(s: SiteSettings, t: Ticket, message: string, agent: string): Rendered {
  const text = esc(message).replace(/\n/g, '<br>');
  const body =
    `<p style="margin:0 0 16px;font-size:13px;color:${C.umber}">Reply from ${esc(agent)} · reference ${esc(t.ref)}</p>` +
    `<div style="font-size:15px;line-height:1.65;color:${C.ink}">${text}</div>` +
    button(`${siteUrl()}/support/${t.accessToken}`, 'Reply or view the conversation');
  return { subject: `Re: ${t.topic} (${t.ref})`, html: layout(s, body) };
}

export function lotAlert(s: SiteSettings, productName: string, productUrl: string, lot: { code: string; purity: string; testedAt: Date }, unsubscribeUrl?: string): Rendered {
  const body =
    h1('New lot tested') +
    p(`A new lot of <b>${esc(productName)}</b> is in stock: lot <b>${esc(lot.code)}</b>, ${esc(lot.purity)}% purity by HPLC, tested ${fdate(lot.testedAt)}. The full report is online.`) +
    button(productUrl, `View ${productName}`);
  return { subject: `New lot of ${productName}: ${lot.code} at ${lot.purity}%`, html: layout(s, body, { unsubscribeUrl }) };
}

export function welcomeCode(s: SiteSettings, code: string, pct: number, unsubscribeUrl: string): Rendered {
  const body =
    h1(`${pct}% off your first order`) +
    p('Thanks for joining. Use this code at checkout:') +
    `<p style="margin:0 0 16px;font-family:Menlo,monospace;font-size:26px;font-weight:700;letter-spacing:.08em;color:${C.ink}">${esc(code)}</p>` +
    p('We will email you when a new lot is tested or a product is back in stock. One or two emails a month.', `color:${C.umber};font-size:14px`) +
    button(`${siteUrl()}/shop`, 'Shop the range');
  return { subject: `Your ${pct}% code: ${code}`, html: layout(s, body, { unsubscribeUrl }) };
}

// ─────────────────── Team notifications ───────────────────

export function adminNewOrder(o: OrderFull, s: SiteSettings): Rendered {
  const method = o.paymentMethod === 'bank_transfer' ? 'Bank transfer (awaiting payment)' : o.status === 'paid' ? 'Paid' : 'Card (awaiting confirmation)';
  const body =
    h1(`New order ${esc(o.number)}`) +
    p(`<b>${m2(o.total)}</b> · ${esc(method)} · ${esc(o.shippingMethodName)}`) +
    p(`${esc(o.name)} &lt;${esc(o.email)}&gt;`) +
    itemsTable(o) +
    button(`${siteUrl()}/admin/orders/${o.id}`, 'Open in admin');
  return { subject: `New order ${o.number} · ${m2(o.total)}`, html: layout(s, body) };
}

export function adminNewTicket(s: SiteSettings, t: Ticket, message: string): Rendered {
  const body =
    h1('New message') +
    p(`<b>${esc(t.name)}</b> &lt;${esc(t.email)}&gt; · ${esc(t.topic)}${t.orderNumber ? ` · order ${esc(t.orderNumber)}` : ''}`) +
    `<div style="font-size:15px;line-height:1.6;padding:14px 16px;background:${C.milk};border-radius:4px">${esc(message).replace(/\n/g, '<br>')}</div>` +
    button(`${siteUrl()}/admin/inbox/${t.id}`, 'Reply in admin');
  return { subject: `New message from ${t.name}: ${t.topic}`, html: layout(s, body) };
}

// ─────────────────── Affiliates ───────────────────

const first = (name: string) => esc(name.trim().split(/\s+/)[0] || 'there');
const pctOf = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;
const bigCode = (code: string) =>
  `<p style="margin:0 0 16px;font-family:Menlo,monospace;font-size:26px;font-weight:700;letter-spacing:.08em;color:${C.ink}">${esc(code)}</p>`;
const portal = (path = '') => `${siteUrl()}/affiliates/portal${path}`;

export function affiliateApplied(s: SiteSettings, name: string): Rendered {
  const body =
    h1('Application received') +
    p(`Thanks, ${first(name)}. We review every application by hand and reply by email within a few working days.`) +
    p('While you wait, have a read of the programme rules. Everything you post has to stay within laboratory research: no claims about tanning, doses or use in people.', `color:${C.umber};font-size:14px`) +
    button(`${siteUrl()}/affiliates/terms`, 'Read the programme rules');
  return { subject: `Your ${s.storeName} affiliate application`, html: layout(s, body) };
}

export function affiliateAlreadyRegistered(s: SiteSettings): Rendered {
  const body =
    h1('You already have an account') +
    p('Someone, hopefully you, just applied to the affiliate programme with this email address. It already has an affiliate account, so there is nothing new to set up.') +
    p('If you have forgotten your password, use the link on the sign in page to choose a new one.', `color:${C.umber};font-size:14px`) +
    button(`${siteUrl()}/affiliates/login`, 'Sign in to the affiliate portal') +
    small('If this was not you, you can ignore this email.');
  return { subject: `Your ${s.storeName} affiliate account`, html: layout(s, body) };
}

export function affiliateApproved(s: SiteSettings, a: Pick<Affiliate, 'name' | 'code' | 'commissionBps' | 'customerDiscountPct'>, link: string): Rendered {
  const offer = a.customerDiscountPct > 0 ? `Customers get <b>${a.customerDiscountPct}% off</b> with it, and you earn` : 'Orders placed with it are credited to you, and you earn';
  const body =
    h1('Your account is ready') +
    p(`Good news, ${first(a.name)}: you are on the ${esc(s.storeName)} affiliate programme. Your code is`) +
    bigCode(a.code) +
    p(`${offer} <b>${pctOf(a.commissionBps)}</b> of the order value after discounts, excluding delivery.`) +
    p(`Your link: <a href="${siteUrl()}/r/${esc(a.code)}" style="color:${C.ink}">${siteUrl()}/r/${esc(a.code)}</a>`, 'font-size:14px') +
    button(link, 'Choose your password') +
    small('The button works once and expires in 7 days. After that, use “Forgot your password?” on the sign in page.');
  return { subject: `Your ${s.storeName} affiliate account is ready`, html: layout(s, body) };
}

export function affiliateRejected(s: SiteSettings, name: string): Rendered {
  const body =
    h1('Your application') +
    p(`Thanks for applying, ${first(name)}. We are not able to offer you a place on the affiliate programme at the moment.`) +
    p('This is usually down to the audience or how the products would be promoted. You are welcome to apply again in future.', `color:${C.umber};font-size:14px`);
  return { subject: `Your ${s.storeName} affiliate application`, html: layout(s, body) };
}

export function affiliateReset(s: SiteSettings, link: string): Rendered {
  const body =
    h1('Reset your password') +
    p('Use the button below to choose a new password for the affiliate portal. The link works once and expires in one hour.') +
    button(link, 'Choose a new password') +
    small('If you did not ask for this, you can ignore this email. Your password has not changed.');
  return { subject: `Reset your ${s.storeName} affiliate password`, html: layout(s, body) };
}

export function affiliateSale(s: SiteSettings, a: Pick<Affiliate, 'name'>, c: { amount: number; basis: number; orderTail: string }): Rendered {
  const body =
    h1(`${m2(c.amount)} commission`) +
    p(`Nice work, ${first(a.name)}. An order ending ${esc(c.orderTail)} used your code, with an order value of ${m2(c.basis)} after discounts.`) +
    p(`The commission is ready to pay ${s.affiliates.holdDays} days after the order is dispatched, once the returns window has passed.`, `color:${C.umber};font-size:14px`) +
    button(portal(), 'View your sales') +
    small('To stop these emails, untick “Email me for each sale” under Your details in the portal.');
  return { subject: `You earned ${m2(c.amount)} commission`, html: layout(s, body) };
}

export function affiliatePayout(s: SiteSettings, a: Pick<Affiliate, 'name'>, payout: Pick<AffiliatePayout, 'amount' | 'reference'>): Rendered {
  const body =
    h1('Payout sent') +
    p(`Hi ${first(a.name)}, we have sent <b>${m2(payout.amount)}</b> to your bank account${payout.reference ? `, reference <b>${esc(payout.reference)}</b>` : ''}.`) +
    p('It should reach you within one working day. The sales it covers are listed in your portal.', `color:${C.umber};font-size:14px`) +
    button(portal('/payouts'), 'View your payouts');
  return { subject: `Payout of ${m2(payout.amount)} sent`, html: layout(s, body) };
}

export function affiliateBankChanged(s: SiteSettings, name: string): Rendered {
  const body =
    h1('Bank details changed') +
    p(`Hi ${first(name)}, the bank details for your affiliate payouts were just changed.`) +
    p('If this was you, there is nothing else to do. If it was not, reply to this email straight away and we will hold your payouts while we check.') +
    button(portal('/details'), 'Check your details');
  return { subject: `Your ${s.storeName} affiliate bank details were changed`, html: layout(s, body) };
}

export function adminAffiliateApplication(s: SiteSettings, a: Pick<Affiliate, 'id' | 'name' | 'email' | 'website' | 'pitch'>): Rendered {
  const body =
    h1('New affiliate application') +
    p(`<b>${esc(a.name)}</b> &lt;${esc(a.email)}&gt;${a.website ? `<br>${esc(a.website)}` : ''}`) +
    (a.pitch ? `<div style="font-size:15px;line-height:1.6;padding:14px 16px;background:${C.milk};border-radius:4px">${esc(a.pitch).replace(/\n/g, '<br>')}</div>` : '') +
    button(`${siteUrl()}/admin/affiliates/${a.id}`, 'Review in admin');
  return { subject: `New affiliate application: ${a.name}`, html: layout(s, body) };
}

export function adminAffiliateBankChanged(s: SiteSettings, a: Pick<Affiliate, 'id' | 'name' | 'code'>): Rendered {
  const body =
    h1('Affiliate bank details changed') +
    p(`<b>${esc(a.name)}</b> (${esc(a.code)}) changed the bank account their payouts go to. Make sure the change is genuine before the next payout.`) +
    button(`${siteUrl()}/admin/affiliates/${a.id}`, 'Open in admin');
  return { subject: `Bank details changed: ${a.name} (${a.code})`, html: layout(s, body) };
}

export function adminTestEmail(s: SiteSettings, name: string): Rendered {
  const body =
    h1('Email is working') +
    p(`Hello ${first(name)}. This test from Admin › Settings › Connections reached you, so order confirmations, dispatch notes and password links will go out too.`) +
    small('If this landed in spam, add your email provider’s SPF and DKIM records to your domain.');
  return { subject: `Test email from ${s.storeName}`, html: layout(s, body) };
}

export function adminConnectionChanged(s: SiteSettings, what: string, by: string): Rendered {
  const body =
    h1(`${esc(what)} changed`) +
    p(`<b>${esc(by)}</b> changed the ${esc(what.toLowerCase())} in Admin › Settings › Connections. If this was not someone on your team, sign in, put back your own details and change your password straight away.`) +
    button(`${siteUrl()}/admin/settings?tab=connections`, 'Open Connections');
  return { subject: `${s.storeName}: ${what} changed`, html: layout(s, body) };
}
