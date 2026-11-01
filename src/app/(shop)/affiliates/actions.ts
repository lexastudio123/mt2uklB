'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { hashPassword, PASSWORD_MIN, verifyPassword } from '@/lib/auth';
import {
  canSignIn,
  consumeAffiliateToken,
  createAffiliateToken,
  endAffiliateSession,
  endAllAffiliateSessions,
  getAffiliate,
  startAffiliateSession,
} from '@/lib/affiliate-auth';
import { cleanBank, notifyTeam, sealBank, sendAffiliateEmail, suggestCode, toBps } from '@/lib/affiliates';
import { getSettings } from '@/lib/settings';
import * as T from '@/lib/email/templates';
import { logActivity } from '@/lib/activity';
import { clientIp, rateLimit } from '@/lib/security';
import { EMAIL_RE, siteUrl } from '@/lib/site';

export type FormState = { error?: string; errors?: Record<string, string>; message?: string; ok?: boolean; values?: Record<string, string> };

const field = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
const ipKey = async (k: string) => `${k}:${clientIp(await headers())}`;
const safeNext = (n: unknown) => {
  const s = String(n || '');
  return s.startsWith('/affiliates/portal') ? s : '/affiliates/portal';
};

// ───────── Apply ─────────

export async function applyAction(_p: FormState, fd: FormData): Promise<FormState> {
  const s = await getSettings();
  if (!s.affiliates.enabled || !s.affiliates.applicationsOpen) return { error: 'Applications are closed at the moment.' };
  const values = {
    name: field(fd, 'name', 120),
    email: field(fd, 'email', 200).toLowerCase(),
    website: field(fd, 'website', 300),
    socials: field(fd, 'socials', 1000),
    pitch: field(fd, 'pitch', 2000),
    code: field(fd, 'code', 20),
  };
  // Hidden field that people never see; bots fill it in.
  if (field(fd, 'company_site', 200)) return { ok: true, message: 'Thanks. Your application is in.' };
  const errors: Record<string, string> = {};
  if (values.name.length < 2) errors.name = 'Enter your name';
  if (!EMAIL_RE.test(values.email)) errors.email = 'Enter an email address like name@example.com';
  if (!values.website && !values.socials) errors.website = 'Add your website or main social profile';
  if (values.pitch.length < 30) errors.pitch = 'Tell us a little more: who your audience is and how you would share us';
  if (fd.get('agree') !== 'on') errors.agree = 'Tick to confirm you have read and agree to the programme rules';
  if (Object.keys(errors).length) return { errors, values };
  if (!rateLimit(await ipKey('affapply'), 4, 60 * 60_000).ok) return { error: 'Too many applications from this connection. Try again in an hour.', values };

  const done: FormState = { ok: true, message: `Thanks, ${values.name.split(' ')[0]}. Your application is in, and we have emailed ${values.email} to confirm. We reply within a few working days.` };
  const existing = await db.affiliate.findUnique({ where: { email: values.email } });
  if (existing && existing.status !== 'rejected') {
    // Same answer whether or not the address is known; the owner of the address gets the details.
    if (existing.status !== 'pending') await sendAffiliateEmail(existing, T.affiliateAlreadyRegistered(s), 'affiliate_exists');
    return done;
  }
  const data = {
    name: values.name,
    website: values.website || null,
    socials: values.socials || null,
    pitch: values.pitch,
    status: 'pending',
    termsAcceptedAt: new Date(),
    code: await suggestCode(values.name, values.code),
    commissionBps: toBps(s.affiliates.commissionPct),
    customerDiscountPct: s.affiliates.discountPct,
  };
  const a = existing
    ? await db.affiliate.update({ where: { id: existing.id }, data })
    : await db.affiliate.create({ data: { ...data, email: values.email } });
  await sendAffiliateEmail(a, T.affiliateApplied(s, a.name), 'affiliate_applied');
  await notifyTeam(T.adminAffiliateApplication(s, a), 'team_affiliate_application');
  return done;
}

// ───────── Sign in, reset, set password ─────────

export async function affiliateSignIn(_p: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, 'email', 200).toLowerCase();
  const password = String(fd.get('password') || '');
  const values = { email };
  if (!EMAIL_RE.test(email)) return { errors: { email: 'Enter the email you applied with' }, values };
  if (!password) return { errors: { password: 'Enter your password' }, values };
  if (!rateLimit(await ipKey('affsignin'), 20, 15 * 60_000).ok || !rateLimit(`affsignin:${email}`, 8, 15 * 60_000).ok)
    return { error: 'Too many attempts. Wait 15 minutes, or reset your password.', values };
  const a = await db.affiliate.findUnique({ where: { email } });
  const ok = await verifyPassword(password, a?.passwordHash);
  if (!a || !ok || !canSignIn(a)) return { error: 'That email and password do not match an active affiliate account.', values };
  await startAffiliateSession(a.id);
  redirect(safeNext(fd.get('next')));
}

export async function affiliateForgot(_p: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, 'email', 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return { errors: { email: 'Enter the email you applied with' } };
  if (!rateLimit(await ipKey('affforgot'), 6, 15 * 60_000).ok || !rateLimit(`affforgot:${email}`, 3, 15 * 60_000).ok)
    return { error: 'Too many requests. Wait 15 minutes and try again.' };
  const a = await db.affiliate.findUnique({ where: { email } });
  if (a && (a.status === 'active' || a.status === 'paused')) {
    const s = await getSettings();
    const kind = a.passwordHash ? 'reset' : 'invite';
    const link = `${siteUrl()}/affiliates/password?token=${await createAffiliateToken(a.id, kind)}`;
    await sendAffiliateEmail(a, kind === 'reset' ? T.affiliateReset(s, link) : T.affiliateApproved(s, a, link), `affiliate_${kind}`);
  }
  return { ok: true, message: `If ${email} has an affiliate account, a link to choose a new password is on its way. It expires in one hour.` };
}

export async function affiliateSetPassword(_p: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get('password') || '');
  if (password.length < PASSWORD_MIN) return { errors: { password: `Use at least ${PASSWORD_MIN} characters` } };
  if (!rateLimit(await ipKey('affsetpw'), 10, 15 * 60_000).ok) return { error: 'Too many attempts. Wait 15 minutes and try again.' };
  const t = await consumeAffiliateToken(String(fd.get('token') || ''));
  if (!t) return { error: 'This link has expired or was already used. Ask for a new one on the sign in page.' };
  await db.affiliate.update({ where: { id: t.affiliateId }, data: { passwordHash: await hashPassword(password) } });
  await endAllAffiliateSessions(t.affiliateId);
  await startAffiliateSession(t.affiliateId);
  redirect('/affiliates/portal?welcome=1');
}

export async function affiliateSignOut() {
  await endAffiliateSession();
  redirect('/affiliates/login?signedout=1');
}

// ───────── Portal changes ─────────

async function me() {
  const a = await getAffiliate();
  if (!a) redirect('/affiliates/login');
  return a;
}

export async function saveAffiliateProfile(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await me();
  const name = field(fd, 'name', 120);
  if (name.length < 2) return { errors: { name: 'Enter your name' } };
  const opt = (k: string, max: number) => field(fd, k, max) || null;
  await db.affiliate.update({
    where: { id: a.id },
    data: {
      name,
      phone: opt('phone', 40),
      company: opt('company', 120),
      website: opt('website', 300),
      socials: opt('socials', 1000),
      addressLine1: opt('addressLine1', 150),
      addressLine2: opt('addressLine2', 150),
      city: opt('city', 80),
      postcode: opt('postcode', 12)?.toUpperCase() ?? null,
      country: field(fd, 'country', 60) || 'United Kingdom',
      taxRef: opt('taxRef', 40),
      notifySales: fd.get('notifySales') === 'on',
    },
  });
  revalidatePath('/affiliates/portal', 'layout');
  return { ok: true, message: 'Your details are saved.' };
}

export async function saveAffiliateBank(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await me();
  const values = {
    accountName: field(fd, 'accountName', 120),
    sortCode: field(fd, 'sortCode', 20),
    accountNumber: field(fd, 'accountNumber', 20),
    iban: field(fd, 'iban', 40),
    bic: field(fd, 'bic', 20),
  };
  if (!rateLimit(`affbank:${a.id}`, 6, 60 * 60_000).ok) return { error: 'Too many attempts. Try again in an hour.', values };
  if (!(await verifyPassword(String(fd.get('password') || ''), a.passwordHash))) return { errors: { password: 'Your password is not right' }, values };
  const bank = cleanBank(values);
  if (!bank.ok) return { errors: { [bank.field]: bank.error }, values };
  if (!bank.bank.accountName) return { errors: { accountName: 'Enter the name on the account' }, values };
  await db.affiliate.update({ where: { id: a.id }, data: { ...sealBank(bank.bank), bankUpdatedAt: new Date() } });
  await logActivity(null, 'affiliate.bank_update_self', 'affiliate', a.id, `${a.name} changed their bank details in the portal`);
  const s = await getSettings();
  await sendAffiliateEmail(a, T.affiliateBankChanged(s, a.name), 'affiliate_bank_changed');
  await notifyTeam(T.adminAffiliateBankChanged(s, a), 'team_affiliate_bank_changed');
  revalidatePath('/affiliates/portal', 'layout');
  return { ok: true, message: 'Bank details saved. We have emailed you to confirm the change.' };
}

export async function changeAffiliatePassword(_p: FormState, fd: FormData): Promise<FormState> {
  const a = await me();
  const current = String(fd.get('current') || '');
  const next = String(fd.get('password') || '');
  if (!rateLimit(`affpw:${a.id}`, 8, 15 * 60_000).ok) return { error: 'Too many attempts. Wait 15 minutes and try again.' };
  if (!(await verifyPassword(current, a.passwordHash))) return { errors: { current: 'Your current password is not right' } };
  if (next.length < PASSWORD_MIN) return { errors: { password: `Use at least ${PASSWORD_MIN} characters` } };
  await db.affiliate.update({ where: { id: a.id }, data: { passwordHash: await hashPassword(next) } });
  await endAllAffiliateSessions(a.id, true);
  return { ok: true, message: 'Password changed. Other devices have been signed out.' };
}
