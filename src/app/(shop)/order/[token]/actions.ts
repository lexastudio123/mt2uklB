'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { createAuthToken, hashPassword, PASSWORD_MIN, startCustomerSession } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { sendEmail } from '@/lib/email/send';
import { claimAccount, welcome } from '@/lib/email/templates';
import { clientIp, rateLimit } from '@/lib/security';
import { siteUrl } from '@/lib/site';

export type FormState = { error?: string; sent?: boolean; message?: string };

/**
 * "Save your details for next time" after checkout. A password is set directly only for a brand new
 * customer placing their first order from this page; otherwise we email a link, so nobody can take over
 * an existing order history just by knowing an email address.
 */
export async function saveAccountFromOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const ip = clientIp(await headers());
  if (!rateLimit(`save-acct:${ip}`, 8, 15 * 60_000).ok) return { error: 'Too many attempts. Try again in a few minutes.' };
  const token = String(fd.get('token') || '');
  const password = String(fd.get('password') || '');
  if (password.length < PASSWORD_MIN) return { error: `Use at least ${PASSWORD_MIN} characters` };

  const order = await db.order.findUnique({ where: { accessToken: token }, include: { customer: true } });
  if (!order?.customer) return { error: 'We could not find that order.' };
  const c = order.customer;
  if (c.passwordHash) return { error: 'You already have an account. Sign in from the account page.' };

  const s = await getSettings();
  const others = await db.order.count({ where: { customerId: c.id, id: { not: order.id } } });
  const fresh = Date.now() - order.createdAt.getTime() < 24 * 36e5;
  if (others > 0 || !fresh) {
    const t = await createAuthToken(c.id, 'claim', 24 * 60);
    const r = claimAccount(s, `${siteUrl()}/account/reset?token=${t}`);
    await sendEmail({ to: c.email, subject: r.subject, html: r.html, template: 'account_claim', customerId: c.id });
    return { sent: true, message: `For your security we have emailed ${c.email} a link to finish setting up your account.` };
  }

  await db.customer.update({ where: { id: c.id }, data: { passwordHash: await hashPassword(password), name: c.name || order.name } });
  const w = welcome(s, c.name || order.name);
  await sendEmail({ to: c.email, subject: w.subject, html: w.html, template: 'welcome', customerId: c.id });
  await startCustomerSession(c.id);
  redirect('/account/orders');
}
