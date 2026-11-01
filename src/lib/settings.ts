import 'server-only';
import { cache } from 'react';
import { db } from './db';
import type { ShipMethod } from './eta';

export type SiteSettings = {
  storeName: string;
  supportEmail: string;
  notifyEmail: string; // where new order and message alerts go
  phone: string;
  company: { name: string; address: string; number: string; jurisdiction: string; vatNumber: string };
  noindex: boolean; // hide from search engines until launch
  legalReviewed: boolean; // hides the "template" note on legal pages
  showSampleNotice: boolean; // footer note while lot data is sample content
  announcement: string; // notice bar, right-hand text; empty uses the default
  shipping: {
    freeOver: number; // pence
    cutoffHour: number;
    methods: ShipMethod[];
    closedDates: string[];
    countries: string[];
    packaging: string;
  };
  payments: {
    bankTransfer: {
      enabled: boolean;
      accountName: string;
      sortCode: string;
      accountNumber: string;
      iban: string;
      bic: string;
      expiryDays: number; // cancel unpaid bank transfer orders after this many days
    };
    card: { enabled: boolean };
  };
  checkout: { ruoText: string; minAge: number };
  marketing: { popupEnabled: boolean; popupDelay: number; welcomeCode: string; welcomePct: number };
  referral: { enabled: boolean; discountPct: number; creditPence: number };
  affiliates: {
    enabled: boolean; // partner codes work at checkout and the programme pages are live
    applicationsOpen: boolean;
    commissionPct: number; // starting rate for new affiliates, e.g. 15 or 12.5
    discountPct: number; // starting customer discount on their code
    holdDays: number; // days after dispatch before commission is ready to pay (covers returns)
    minPayout: number; // pence
    payoutSchedule: string; // shown to affiliates
  };
  chat: { enabled: boolean; aiEnabled: boolean };
  returnsDays: number;
  vatRate: number;
};

// England and Wales bank holidays. Edit in Admin › Settings › Delivery.
const BANK_HOLIDAYS = [
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
];

export const DEFAULT_SETTINGS: SiteSettings = {
  storeName: 'MT2 Lab',
  supportEmail: 'support@example.co.uk',
  notifyEmail: '',
  phone: '',
  company: {
    name: '[Company name] Ltd',
    address: '[Registered office address]',
    number: '[00000000]',
    jurisdiction: 'England and Wales',
    vatNumber: '',
  },
  noindex: true,
  legalReviewed: false,
  showSampleNotice: true,
  announcement: '',
  shipping: {
    freeOver: 5000,
    cutoffHour: 15,
    methods: [
      { id: 'std', name: 'Tracked 24', price: 495, note: 'Royal Mail, plain padded envelope', min: 1, max: 1, freeOver: true, active: true },
      { id: 'exp', name: 'Special Delivery', price: 895, note: 'Guaranteed by 1pm next working day, signed for', min: 1, max: 1, freeOver: false, active: true },
    ],
    closedDates: BANK_HOLIDAYS,
    countries: ['United Kingdom'],
    packaging: 'Vials travel in a padded sleeve inside a plain padded envelope. Nothing on the outside shows what is inside.',
  },
  payments: {
    bankTransfer: { enabled: true, accountName: '', sortCode: '', accountNumber: '', iban: '', bic: '', expiryDays: 3 },
    card: { enabled: true },
  },
  checkout: {
    ruoText: 'I confirm I am 18 or over and that these vials are for laboratory research only, not for human or veterinary use.',
    minAge: 18,
  },
  marketing: { popupEnabled: true, popupDelay: 25, welcomeCode: 'WELCOME10', welcomePct: 10 },
  referral: { enabled: true, discountPct: 10, creditPence: 500 },
  affiliates: {
    enabled: true,
    applicationsOpen: true,
    commissionPct: 15,
    discountPct: 10,
    holdDays: 30,
    minPayout: 5000,
    payoutSchedule: 'Monthly by bank transfer, in the first week of the month',
  },
  chat: { enabled: true, aiEnabled: true },
  returnsDays: 30,
  vatRate: 20,
};

const KEY = 'site';

type Obj = Record<string, unknown>;
function merge<T>(base: T, over: unknown): T {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) {
    return (over === undefined || over === null ? base : over) as T;
  }
  const out: Obj = { ...(base as Obj) };
  if (over && typeof over === 'object' && !Array.isArray(over)) {
    for (const [k, v] of Object.entries(over as Obj)) {
      out[k] = k in out ? merge(out[k], v) : v;
    }
  }
  return out as T;
}

/** Settings for this request (defaults merged with what is saved). */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    return merge(DEFAULT_SETTINGS, JSON.parse(row.value));
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/** Save a partial update. Nested objects are merged; arrays are replaced. */
export async function saveSettings(patch: Partial<SiteSettings> | Obj): Promise<SiteSettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  let current: SiteSettings = DEFAULT_SETTINGS;
  if (row) {
    try {
      current = merge(DEFAULT_SETTINGS, JSON.parse(row.value));
    } catch {}
  }
  const next = merge(current, patch);
  await db.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(next) }, create: { key: KEY, value: JSON.stringify(next) } });
  return next;
}

export const activeMethods = (s: SiteSettings) => s.shipping.methods.filter((m) => m.active);

export function cardPaymentsAvailable(s: SiteSettings): boolean {
  return s.payments.card.enabled && !!process.env.STRIPE_SECRET_KEY;
}

export function bankTransferAvailable(s: SiteSettings): boolean {
  const b = s.payments.bankTransfer;
  return b.enabled && !!(b.accountNumber && b.sortCode);
}

/** Client-safe subset passed to the browser. */
export function publicConfig(s: SiteSettings) {
  return {
    storeName: s.storeName,
    supportEmail: s.supportEmail,
    freeOver: s.shipping.freeOver,
    cutoffHour: s.shipping.cutoffHour,
    closedDates: s.shipping.closedDates,
    methods: activeMethods(s),
    countries: s.shipping.countries,
    ruoText: s.checkout.ruoText,
    popup: s.marketing,
    referral: s.referral,
    chatEnabled: s.chat.enabled,
    returnsDays: s.returnsDays,
    card: cardPaymentsAvailable(s),
    bank: bankTransferAvailable(s),
    addressLookup: !!process.env.IDEAL_POSTCODES_API_KEY,
  };
}
export type PublicConfig = ReturnType<typeof publicConfig>;
