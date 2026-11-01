import 'server-only';
import { db } from './db';
import { newToken, randomCode, randomDigits } from './security';

/** Unique order number such as MT48213 (6 digits once 5-digit numbers get crowded). */
export async function newOrderNumber(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const n = 'MT' + randomDigits(i < 8 ? 5 : 6).replace(/^0/, '1');
    if (!(await db.order.findUnique({ where: { number: n }, select: { id: true } }))) return n;
  }
  return 'MT' + randomDigits(6);
}

export async function newTicketRef(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const r = 'C' + randomDigits(6).replace(/^0/, '1');
    if (!(await db.ticket.findUnique({ where: { ref: r }, select: { id: true } }))) return r;
  }
  return 'C' + randomDigits(8);
}

/** Referral code such as MT-JANE-7K2Q. */
export async function newReferralCode(name: string): Promise<string> {
  const stem = (name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'LAB';
  for (let i = 0; i < 10; i++) {
    const c = `MT-${stem}-${randomCode(4)}`;
    if (!(await db.customer.findUnique({ where: { referralCode: c }, select: { id: true } }))) return c;
  }
  return `MT-${randomCode(10)}`;
}

export const newAccessToken = () => newToken(24);
