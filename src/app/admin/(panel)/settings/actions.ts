'use server';

import type { AdminUser } from '@prisma/client';
import { db } from '@/lib/db';
import { getSettings, saveSettings } from '@/lib/settings';
import { getConnections, saveConnections } from '@/lib/connections';
import { checkMailConfig, sendEmail } from '@/lib/email/send';
import { adminConnectionChanged, adminTestEmail } from '@/lib/email/templates';
import { checkStripeKey } from '@/lib/payments/stripe';
import type { ShipMethod } from '@/lib/eta';
import { EMAIL_RE } from '@/lib/site';
import { logActivity } from '@/lib/activity';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { bool, int, lines, pounds, str } from '@/lib/admin/forms';

type R = { ok?: string; err?: string };
const to = (tab: string) => `/admin/settings?tab=${tab}`;

function email(fd: FormData, k: string, label: string, optional = false) {
  const v = str(fd, k, 200).toLowerCase();
  if (!v && optional) return '';
  if (!EMAIL_RE.test(v)) throw new UserError(`${label} must be an email address.`);
  return v;
}

export async function saveStoreAction(fd: FormData) {
  const a = await requireArea('settings');
  let r: R;
  try {
    const storeName = str(fd, 'storeName', 60);
    if (storeName.length < 2) throw new UserError('Enter the shop name.');
    await saveSettings({
      storeName,
      supportEmail: email(fd, 'supportEmail', 'Support email'),
      notifyEmail: email(fd, 'notifyEmail', 'Notification email', true),
      phone: str(fd, 'phone', 40),
      announcement: str(fd, 'announcement', 140),
      company: {
        name: str(fd, 'companyName', 120),
        address: str(fd, 'companyAddress', 240),
        number: str(fd, 'companyNumber', 20),
        jurisdiction: str(fd, 'companyJurisdiction', 60) || 'England and Wales',
        vatNumber: str(fd, 'vatNumber', 20),
      },
      noindex: bool(fd, 'noindex'),
      legalReviewed: bool(fd, 'legalReviewed'),
      showSampleNotice: bool(fd, 'showSampleNotice'),
    });
    await logActivity(a.id, 'settings.store', 'settings', 'store');
    r = { ok: 'Store details saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('store'), r);
}

export async function saveDeliveryAction(fd: FormData) {
  const a = await requireArea('settings');
  let r: R;
  try {
    const count = int(fd, 'methodCount', { min: 0, max: 20 });
    const methods: ShipMethod[] = [];
    for (let i = 0; i <= count; i++) {
      const p = `m${i}_`;
      const name = str(fd, p + 'name', 60);
      if (bool(fd, p + 'remove') || (!name && i === count)) continue;
      const id = (str(fd, p + 'id', 20) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-+|-+$/g, '');
      if (!name) throw new UserError(`Delivery option ${i + 1} needs a name.`);
      if (!/^[a-z0-9-]{2,20}$/.test(id)) throw new UserError(`“${name}” needs a short id of lower case letters, numbers or dashes.`);
      if (methods.some((m) => m.id === id)) throw new UserError(`Two delivery options use the id “${id}”.`);
      const min = int(fd, p + 'min', { min: 0, max: 30, label: `${name} fastest days` });
      const max = int(fd, p + 'max', { min: 0, max: 30, label: `${name} slowest days` });
      if (max < min) throw new UserError(`${name}: the slowest delivery cannot be quicker than the fastest.`);
      methods.push({
        id,
        name,
        price: pounds(fd, p + 'price', { min: 0, label: `${name} price` }),
        note: str(fd, p + 'note', 120),
        min,
        max,
        freeOver: bool(fd, p + 'freeOver'),
        active: bool(fd, p + 'active'),
      });
    }
    if (!methods.some((m) => m.active)) throw new UserError('Keep at least one delivery option switched on, or checkout cannot work.');
    const closedDates = lines(str(fd, 'closedDates', 4000));
    const bad = closedDates.find((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(+new Date(d)));
    if (bad) throw new UserError(`“${bad}” is not a date. Use one YYYY-MM-DD date per line.`);
    await saveSettings({
      shipping: {
        freeOver: pounds(fd, 'freeOver', { min: 0, label: 'Free delivery threshold' }),
        cutoffHour: int(fd, 'cutoffHour', { min: 0, max: 23, label: 'Dispatch cutoff' }),
        methods,
        closedDates: [...new Set(closedDates)].sort(),
        packaging: str(fd, 'packaging', 400),
      },
    });
    await logActivity(a.id, 'settings.delivery', 'settings', 'delivery', methods.map((m) => `${m.name} ${m.price}`).join(', '));
    r = { ok: 'Delivery settings saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('delivery'), r);
}

export async function savePaymentsAction(fd: FormData) {
  const a = await requireArea('settings');
  let r: R;
  try {
    const enabled = bool(fd, 'bankEnabled');
    const sortDigits = str(fd, 'sortCode', 20).replace(/\D/g, '');
    const accountNumber = str(fd, 'accountNumber', 20).replace(/\D/g, '');
    const accountName = str(fd, 'accountName', 80);
    const iban = str(fd, 'iban', 40).toUpperCase().replace(/\s+/g, '');
    const bic = str(fd, 'bic', 20).toUpperCase().replace(/\s+/g, '');
    if (sortDigits && sortDigits.length !== 6) throw new UserError('The sort code has 6 digits, like 12-34-56.');
    if (accountNumber && accountNumber.length !== 8) throw new UserError('The account number has 8 digits.');
    if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) throw new UserError('That IBAN does not look right.');
    if (bic && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic)) throw new UserError('A BIC has 8 or 11 letters and numbers.');
    if (enabled && (!accountName || !sortDigits || !accountNumber)) throw new UserError('Fill in the account name, sort code and account number, or switch bank transfer off.');
    await saveSettings({
      payments: {
        bankTransfer: {
          enabled,
          accountName,
          sortCode: sortDigits ? sortDigits.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3') : '',
          accountNumber,
          iban,
          bic,
          expiryDays: int(fd, 'expiryDays', { min: 1, max: 30, label: 'Days to pay' }),
        },
        card: { enabled: bool(fd, 'cardEnabled') },
      },
    });
    await logActivity(a.id, 'settings.payments', 'settings', 'payments', `bank ${enabled ? 'on' : 'off'}, card ${bool(fd, 'cardEnabled') ? 'on' : 'off'}`);
    r = { ok: 'Payment settings saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('payments'), r);
}

export async function saveCheckoutAction(fd: FormData) {
  const a = await requireArea('settings');
  let r: R;
  try {
    const ruoText = str(fd, 'ruoText', 400);
    if (ruoText.length < 20) throw new UserError('The research-use confirmation needs a full sentence.');
    await saveSettings({ checkout: { ruoText, minAge: int(fd, 'minAge', { min: 16, max: 25, label: 'Minimum age' }) } });
    await logActivity(a.id, 'settings.checkout', 'settings', 'checkout');
    r = { ok: 'Checkout settings saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('checkout'), r);
}

export async function saveMarketingAction(fd: FormData) {
  const a = await requireArea('settings');
  let r: R;
  try {
    const welcomeCode = str(fd, 'welcomeCode', 40).toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(welcomeCode)) throw new UserError('The welcome code uses 3 to 40 letters or numbers.');
    const welcomePct = int(fd, 'welcomePct', { min: 1, max: 50, label: 'Welcome discount' });
    await saveSettings({
      marketing: { popupEnabled: bool(fd, 'popupEnabled'), popupDelay: int(fd, 'popupDelay', { min: 5, max: 600, label: 'Pop-up delay' }), welcomeCode, welcomePct },
    });
    // Keep the matching discount code in step with what the pop-up promises.
    await db.discountCode.upsert({
      where: { code: welcomeCode },
      update: { kind: 'percent', value: welcomePct, firstOrderOnly: true, active: true },
      create: { code: welcomeCode, kind: 'percent', value: welcomePct, firstOrderOnly: true, active: true, description: 'Sign-up pop-up welcome code' },
    });
    await logActivity(a.id, 'settings.marketing', 'settings', 'marketing', `${welcomeCode} ${welcomePct}%`);
    r = { ok: `Saved. ${welcomeCode} gives ${welcomePct}% off a first order and is active under Discounts.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('marketing'), r);
}

export async function saveReferralAction(fd: FormData) {
  const a = await requireArea('settings');
  let r: R;
  try {
    await saveSettings({
      referral: {
        enabled: bool(fd, 'enabled'),
        discountPct: int(fd, 'discountPct', { min: 0, max: 50, label: 'Friend discount' }),
        creditPence: pounds(fd, 'credit', { min: 0, label: 'Referrer credit' }),
      },
    });
    await logActivity(a.id, 'settings.referral', 'settings', 'referral');
    r = { ok: 'Referral settings saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('referral'), r);
}

export async function saveAffiliateSettingsAction(fd: FormData) {
  const a = await requireArea('settings');
  let r: R;
  try {
    const commission = Number(str(fd, 'commissionPct', 10).replace('%', ''));
    if (!Number.isFinite(commission) || commission < 0 || commission > 50) throw new UserError('Commission must be between 0% and 50%.');
    await saveSettings({
      affiliates: {
        enabled: bool(fd, 'enabled'),
        applicationsOpen: bool(fd, 'applicationsOpen'),
        commissionPct: Math.round(commission * 100) / 100,
        discountPct: int(fd, 'discountPct', { min: 0, max: 50, label: 'Customer discount' }),
        holdDays: int(fd, 'holdDays', { min: 0, max: 120, label: 'Hold period' }),
        minPayout: pounds(fd, 'minPayout', { min: 0, label: 'Minimum payout' }),
        payoutSchedule: str(fd, 'payoutSchedule', 200) || 'Monthly by bank transfer',
      },
    });
    await logActivity(a.id, 'settings.affiliates', 'settings', 'affiliates');
    r = { ok: 'Affiliate settings saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('affiliates'), r);
}

export async function saveChatAction(fd: FormData) {
  const a = await requireArea('settings');
  let r: R;
  try {
    await saveSettings({ chat: { enabled: bool(fd, 'enabled'), aiEnabled: bool(fd, 'aiEnabled') } });
    await logActivity(a.id, 'settings.chat', 'settings', 'chat');
    r = { ok: 'Chat settings saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('chat'), r);
}

export async function saveOtherAction(fd: FormData) {
  const a = await requireArea('settings');
  let r: R;
  try {
    const s = await getSettings();
    await saveSettings({
      returnsDays: int(fd, 'returnsDays', { min: 0, max: 365, label: 'Returns window' }),
      vatRate: int(fd, 'vatRate', { min: 0, max: 30, label: 'VAT rate' }),
    });
    await logActivity(a.id, 'settings.other', 'settings', 'other', `returns ${s.returnsDays}→${str(fd, 'returnsDays')}`);
    r = { ok: 'Saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('other'), r);
}

// ───────── Connections (owners only) ─────────

const secret = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim().slice(0, 400);
const IN_ENV = 'This is set in the server’s .env file, which takes priority. Change it there.';

/**
 * Tell every owner when payment or email details change, in case an admin account has been taken over.
 * Sent before an email change is saved, so it goes out through the details being replaced.
 */
async function alertOwners(by: AdminUser, what: string) {
  const [s, owners] = await Promise.all([getSettings(), db.adminUser.findMany({ where: { role: 'owner', active: true }, select: { email: true } })]);
  const mail = adminConnectionChanged(s, what, by.name);
  for (const o of owners) await sendEmail({ to: o.email, template: 'team_connection_changed', ...mail });
}

export type EmailFormState = { err?: string; values?: { host: string; port: string; user: string; from: string } };

export async function saveEmailConnectionAction(_prev: EmailFormState, fd: FormData): Promise<EmailFormState> {
  const a = await requireArea('connections');
  // Shown again if the test fails, so nothing has to be retyped except the password.
  const values = { host: str(fd, 'smtpHost', 200), port: str(fd, 'smtpPort', 10), user: str(fd, 'smtpUser', 200), from: str(fd, 'mailFrom', 200) };
  let r: R;
  try {
    const c = await getConnections();
    if (c.mailSource === 'env') throw new UserError(IN_ENV);
    const host = values.host.toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) throw new UserError('Enter the SMTP server, like smtp.example.com.');
    const port = int(fd, 'smtpPort', { min: 1, max: 65535, label: 'Port' });
    const { user, from } = values;
    const typed = String(fd.get('smtpPass') ?? '').slice(0, 400);
    if (from && !/^([^<>@]*<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/.test(from)) {
      throw new UserError('“From” should be an email address, or a name and address like MT2 Lab <orders@yourdomain.co.uk>.');
    }
    const pass = typed || c.mail?.pass || '';
    if (user && !pass) throw new UserError('Enter the SMTP password.');
    const mail = { host, port, secure: port === 465, user, pass, from };
    const problem = await checkMailConfig(mail);
    if (problem) throw new UserError(`Could not sign in to ${host}: ${problem.replace(/\.?$/, '.')} Nothing was saved.`);
    if (c.mail && (c.mail.host !== host || c.mail.user !== user)) await alertOwners(a, 'Email sending details');
    await saveConnections({ smtp: { host, port, user, pass: typed || undefined, from } });
    await logActivity(a.id, 'settings.connections', 'settings', 'email', `Email via ${host}:${port}`);
    const test = await sendEmail({ to: a.email, template: 'team_test_email', ...adminTestEmail(await getSettings(), a.name) }, mail);
    r = test.status === 'sent' ? { ok: `Email is connected. A test email is on its way to ${a.email}.` } : { err: `Saved, but the test email to ${a.email} failed. Open Emails to see why.` };
  } catch (e) {
    return { err: errorMessage(e), values };
  }
  back(to('connections'), r);
}

export async function removeEmailConnectionAction() {
  const a = await requireArea('connections');
  let r: R;
  try {
    if ((await getConnections()).mailSource === 'admin') await alertOwners(a, 'Email sending details');
    await saveConnections({ smtp: null });
    await logActivity(a.id, 'settings.connections', 'settings', 'email', 'Removed email details');
    r = { ok: 'Email details removed. Emails are now recorded under Emails but not sent.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('connections'), r);
}

export async function saveStripeKeysAction(fd: FormData) {
  const a = await requireArea('connections');
  let r: R;
  try {
    const c = await getConnections();
    const key = secret(fd, 'stripeKey');
    const hook = secret(fd, 'stripeWebhook');
    if (!key && !hook) throw new UserError('Paste a key to save.');
    if (key) {
      if (c.stripeKeySource === 'env') throw new UserError(IN_ENV);
      if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(key)) throw new UserError('The secret key starts with sk_live_ or sk_test_. Find it in Stripe under Developers › API keys.');
      const problem = await checkStripeKey(key);
      if (problem) throw new UserError(`Stripe did not accept that key: ${problem}`);
    }
    if (hook) {
      if (c.stripeWebhookSource === 'env') throw new UserError(IN_ENV);
      if (!/^whsec_[A-Za-z0-9+/=_-]{16,}$/.test(hook)) throw new UserError('The signing secret starts with whsec_. Find it in Stripe under Developers › Webhooks, on your endpoint.');
    }
    await saveConnections({ ...(key ? { stripeSecretKey: key } : {}), ...(hook ? { stripeWebhookSecret: hook } : {}) });
    const what = key && hook ? 'Stripe keys' : key ? 'Stripe secret key' : 'Stripe webhook secret';
    await logActivity(a.id, 'settings.connections', 'settings', 'stripe', `Changed the ${what}`);
    await alertOwners(a, what);
    const missing = !(key || c.stripeKey)
      ? ' Add the secret key too.'
      : !(hook || c.stripeWebhookSecret)
        ? ' Add the webhook signing secret too, so paid orders update by themselves.'
        : '';
    r = { ok: `Saved the ${what}.${missing}${key.startsWith('sk_test_') || key.startsWith('rk_test_') ? ' Test mode: pay with card 4242 4242 4242 4242 to try it.' : ''}` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('connections'), r);
}

export async function removeStripeKeysAction() {
  const a = await requireArea('connections');
  let r: R;
  try {
    await saveConnections({ stripeSecretKey: null, stripeWebhookSecret: null });
    await logActivity(a.id, 'settings.connections', 'settings', 'stripe', 'Removed the Stripe keys');
    await alertOwners(a, 'Stripe keys');
    r = { ok: 'Stripe keys removed. Card payment is off until you add them again.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('connections'), r);
}

const SIMPLE_KEYS = {
  anthropic: { field: 'anthropicKey', source: 'anthropicSource', label: 'AI key', re: /^sk-ant-[A-Za-z0-9_-]{20,}$/, hint: 'Anthropic keys start with sk-ant-.' },
  postcodes: { field: 'postcodesKey', source: 'postcodesSource', label: 'Address lookup key', re: /^[A-Za-z0-9_-]{8,100}$/, hint: 'Paste the API key from your Ideal Postcodes account.' },
} as const;

function simpleKey(fd: FormData) {
  const which = str(fd, 'which') as keyof typeof SIMPLE_KEYS;
  if (!(which in SIMPLE_KEYS)) throw new UserError('Unknown key.');
  return SIMPLE_KEYS[which];
}

export async function saveSimpleKeyAction(fd: FormData) {
  const a = await requireArea('connections');
  let r: R;
  try {
    const k = simpleKey(fd);
    const value = secret(fd, 'key');
    if ((await getConnections())[k.source] === 'env') throw new UserError(IN_ENV);
    if (!k.re.test(value)) throw new UserError(`That does not look like the right key. ${k.hint}`);
    await saveConnections({ [k.field]: value });
    await logActivity(a.id, 'settings.connections', 'settings', k.field, `Saved the ${k.label.toLowerCase()}`);
    r = { ok: `${k.label} saved.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('connections'), r);
}

export async function removeSimpleKeyAction(fd: FormData) {
  const a = await requireArea('connections');
  let r: R;
  try {
    const k = simpleKey(fd);
    await saveConnections({ [k.field]: null });
    await logActivity(a.id, 'settings.connections', 'settings', k.field, `Removed the ${k.label.toLowerCase()}`);
    r = { ok: `${k.label} removed.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(to('connections'), r);
}
