'use server';

import { db } from '@/lib/db';
import { getSettings, saveSettings } from '@/lib/settings';
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
