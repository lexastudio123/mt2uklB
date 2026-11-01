'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  createAuthToken,
  consumeAuthToken,
  endAllCustomerSessions,
  endCustomerSession,
  getCustomer,
  hashPassword,
  PASSWORD_MIN,
  startCustomerSession,
  verifyPassword,
} from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { sendEmail } from '@/lib/email/send';
import { claimAccount, magicLink, passwordReset, welcome } from '@/lib/email/templates';
import { newReferralCode } from '@/lib/ids';
import { clientIp, newToken, rateLimit } from '@/lib/security';
import { EMAIL_RE, UK_POSTCODE_RE, formatPostcode, siteUrl } from '@/lib/site';

export type FormState = { error?: string; errors?: Record<string, string>; message?: string; ok?: boolean; values?: Record<string, string> };

const safeNext = (n: unknown) => {
  const s = String(n || '');
  return s.startsWith('/') && !s.startsWith('//') ? s : '/account';
};
const ipKey = async (k: string) => `${k}:${clientIp(await headers())}`;

// ───────── Sign in, sign up, links ─────────

export async function signIn(_p: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  const values = { email };
  if (!EMAIL_RE.test(email)) return { errors: { email: 'Enter the email you used to order' }, values };
  if (!password) return { errors: { password: 'Enter your password' }, values };
  if (!rateLimit(await ipKey('signin'), 20, 15 * 60_000).ok || !rateLimit(`signin:${email}`, 8, 15 * 60_000).ok)
    return { error: 'Too many attempts. Wait 15 minutes or use “Email me a sign in link”.', values };
  const c = await db.customer.findUnique({ where: { email } });
  const ok = await verifyPassword(password, c?.passwordHash);
  // One message for every failure, so nobody can find out whether an email has shopped here.
  if (!c || !ok || c.blocked) return { error: 'That email and password do not match. Ordered as a guest? Use “Email me a sign in link”.', values };
  await startCustomerSession(c.id);
  redirect(safeNext(fd.get('next')));
}

export async function signUp(_p: FormState, fd: FormData): Promise<FormState> {
  const name = String(fd.get('name') || '').trim().slice(0, 120);
  const email = String(fd.get('email') || '').trim().toLowerCase().slice(0, 200);
  const password = String(fd.get('password') || '');
  const values = { name, email };
  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Enter your name';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter an email address like name@example.com';
  if (password.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters`;
  if (Object.keys(errors).length) return { errors, values };
  if (!rateLimit(await ipKey('signup'), 6, 60 * 60_000).ok) return { error: 'Too many new accounts from this connection. Try again later.', values };

  const s = await getSettings();
  const existing = await db.customer.findUnique({ where: { email } });
  if (existing) {
    // Known email (guest orders or an existing account): prove the address belongs to the person
    // before linking a password, and answer the same way in both cases.
    const kind = existing.passwordHash ? 'reset' : 'claim';
    const t = await createAuthToken(existing.id, kind, kind === 'reset' ? 60 : 24 * 60);
    const link = `${siteUrl()}/account/reset?token=${t}`;
    const r = kind === 'reset' ? passwordReset(s, link) : claimAccount(s, link);
    await sendEmail({ to: email, subject: r.subject, html: r.html, template: kind === 'reset' ? 'password_reset' : 'account_claim', customerId: existing.id });
    return { ok: true, message: `Check your inbox: we have emailed ${email} a link to finish setting up your account.` };
  }
  const c = await db.customer.create({ data: { email, name, passwordHash: await hashPassword(password), referralCode: await newReferralCode(name) } });
  const w = welcome(s, name);
  await sendEmail({ to: email, subject: w.subject, html: w.html, template: 'welcome', customerId: c.id });
  await startCustomerSession(c.id);
  redirect(safeNext(fd.get('next')));
}

/** Same reply whether or not the account exists, so emails cannot be probed. */
export async function sendLink(_p: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const kind = fd.get('kind') === 'magic' ? 'magic' : 'reset';
  if (!EMAIL_RE.test(email)) return { errors: { email: 'Enter your email above first' }, values: { email } };
  if (!rateLimit(await ipKey('links'), 8, 60 * 60_000).ok || !rateLimit(`links:${email}`, 3, 60 * 60_000).ok)
    return { error: 'We have sent a few links already. Check your inbox and spam folder.', values: { email } };
  const c = await db.customer.findUnique({ where: { email } });
  if (c && !c.blocked) {
    const s = await getSettings();
    if (kind === 'magic') {
      const t = await createAuthToken(c.id, 'magic', 20);
      const r = magicLink(s, `${siteUrl()}/account/magic?token=${t}`);
      await sendEmail({ to: email, subject: r.subject, html: r.html, template: 'magic_link', customerId: c.id });
    } else {
      const t = await createAuthToken(c.id, 'reset', 60);
      const r = passwordReset(s, `${siteUrl()}/account/reset?token=${t}`);
      await sendEmail({ to: email, subject: r.subject, html: r.html, template: 'password_reset', customerId: c.id });
    }
  }
  return {
    ok: true,
    values: { email },
    message:
      kind === 'magic'
        ? `If ${email} has ordered with us, a one time sign in link is on its way. It expires in 20 minutes.`
        : `If ${email} has an account, a password reset link is on its way. It expires after one hour.`,
  };
}

export async function confirmMagicLink(fd: FormData) {
  const t = await consumeAuthToken(String(fd.get('token') || ''), ['magic']);
  if (!t) redirect('/account?link=expired');
  await db.customer.update({ where: { id: t.customerId }, data: { emailVerifiedAt: t.customer.emailVerifiedAt ?? new Date() } });
  await startCustomerSession(t.customerId);
  redirect('/account');
}

export async function resetPassword(_p: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get('password') || '');
  if (password.length < PASSWORD_MIN) return { errors: { password: `Use at least ${PASSWORD_MIN} characters` } };
  const t = await consumeAuthToken(String(fd.get('token') || ''), ['reset', 'claim']);
  if (!t) return { error: 'This link has expired or was already used. Ask for a new one from the sign in page.' };
  await db.customer.update({ where: { id: t.customerId }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: t.customer.emailVerifiedAt ?? new Date() } });
  await endAllCustomerSessions(t.customerId);
  await startCustomerSession(t.customerId);
  redirect('/account?welcome=1');
}

export async function signOut() {
  await endCustomerSession();
  redirect('/account?signedout=1');
}

// ───────── Signed-in changes ─────────

async function me() {
  const c = await getCustomer();
  if (!c) redirect('/account');
  return c;
}

export async function updateDetails(_p: FormState, fd: FormData): Promise<FormState> {
  const c = await me();
  const name = String(fd.get('name') || '').trim().slice(0, 120);
  const email = String(fd.get('email') || '').trim().toLowerCase().slice(0, 200);
  const phone = String(fd.get('phone') || '').trim().slice(0, 40);
  const password = String(fd.get('password') || '');
  const values = { name, email, phone };
  if (!name) return { errors: { name: 'Enter your name' }, values };
  if (!EMAIL_RE.test(email)) return { errors: { email: 'Enter a valid email address' }, values };
  if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) return { errors: { phone: 'Enter a phone number with digits only' }, values };
  if (email !== c.email) {
    if (!(await verifyPassword(password, c.passwordHash))) return { errors: { password: 'Enter your current password to change your email' }, values };
    if (await db.customer.findUnique({ where: { email } })) return { errors: { email: 'Another account uses that email' }, values };
  }
  await db.customer.update({ where: { id: c.id }, data: { name, phone: phone || null, ...(email !== c.email ? { email, emailVerifiedAt: null } : {}) } });
  revalidatePath('/account', 'layout');
  return { ok: true, message: 'Changes saved', values };
}

export async function changePassword(_p: FormState, fd: FormData): Promise<FormState> {
  const c = await me();
  const current = String(fd.get('current') || '');
  const next = String(fd.get('next') || '');
  if (c.passwordHash && !(await verifyPassword(current, c.passwordHash))) return { errors: { current: 'Your current password is not right' } };
  if (next.length < PASSWORD_MIN) return { errors: { next: `Use at least ${PASSWORD_MIN} characters` } };
  await db.customer.update({ where: { id: c.id }, data: { passwordHash: await hashPassword(next) } });
  await endAllCustomerSessions(c.id, true);
  return { ok: true, message: 'Password updated. Other devices have been signed out.' };
}

export async function setAlert(key: string, on: boolean): Promise<{ ok: boolean }> {
  const c = await me();
  if (key === 'news') {
    await db.customer.update({ where: { id: c.id }, data: { marketingOptIn: on } });
    if (on) await db.subscriber.upsert({ where: { email: c.email }, update: { unsubscribedAt: null }, create: { email: c.email, source: 'account', token: newToken(18) } });
    else await db.subscriber.updateMany({ where: { email: c.email }, data: { unsubscribedAt: new Date() } });
  } else if (key === 'ship') {
    await db.customer.update({ where: { id: c.id }, data: { shippingUpdates: on } });
  } else if (key.startsWith('p-')) {
    const productId = key.slice(2);
    if (!(await db.product.findUnique({ where: { id: productId }, select: { id: true } }))) return { ok: false };
    if (on) await db.productAlert.upsert({ where: { email_productId: { email: c.email, productId } }, update: { customerId: c.id }, create: { email: c.email, productId, customerId: c.id } });
    else await db.productAlert.deleteMany({ where: { email: c.email, productId } });
  }
  return { ok: true };
}

export async function addAddress(_p: FormState, fd: FormData): Promise<FormState> {
  const c = await me();
  const v = {
    name: String(fd.get('name') || '').trim().slice(0, 120),
    line1: String(fd.get('line1') || '').trim().slice(0, 150),
    line2: String(fd.get('line2') || '').trim().slice(0, 150),
    city: String(fd.get('city') || '').trim().slice(0, 80),
    postcode: String(fd.get('postcode') || '').trim().slice(0, 12),
  };
  const errors: Record<string, string> = {};
  if (!v.name) errors.name = 'Enter a name';
  if (v.line1.length < 3) errors.line1 = 'Enter the address';
  if (v.city.length < 2) errors.city = 'Enter the town or city';
  if (!UK_POSTCODE_RE.test(v.postcode)) errors.postcode = 'Enter a UK postcode like SW1A 1AA';
  if (Object.keys(errors).length) return { errors, values: v };
  const count = await db.address.count({ where: { customerId: c.id } });
  if (count >= 10) return { error: 'You can save up to 10 addresses.', values: v };
  await db.address.create({ data: { customerId: c.id, name: v.name, line1: v.line1, line2: v.line2 || null, city: v.city, postcode: formatPostcode(v.postcode), isDefault: count === 0 } });
  revalidatePath('/account/addresses');
  return { ok: true, message: 'Address saved' };
}

export async function removeAddress(fd: FormData) {
  const c = await me();
  const id = String(fd.get('id') || '');
  const a = await db.address.findFirst({ where: { id, customerId: c.id } });
  if (a) {
    await db.address.delete({ where: { id } });
    if (a.isDefault) {
      const next = await db.address.findFirst({ where: { customerId: c.id }, orderBy: { createdAt: 'desc' } });
      if (next) await db.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
  revalidatePath('/account/addresses');
}

export async function makeDefaultAddress(fd: FormData) {
  const c = await me();
  const id = String(fd.get('id') || '');
  if (await db.address.findFirst({ where: { id, customerId: c.id } })) {
    await db.$transaction([
      db.address.updateMany({ where: { customerId: c.id }, data: { isDefault: false } }),
      db.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
  }
  revalidatePath('/account/addresses');
}
