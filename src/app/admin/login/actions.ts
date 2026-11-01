'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { completeAdminMfa, endAdminSession, getPendingAdmin, startAdminSession, verifyPassword } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/security';
import { logActivity } from '@/lib/activity';
import { checkTotp } from '@/lib/totp';

export type LoginState = { error?: string; email?: string };

const safeNext = (next: string) => (next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin');

export async function adminLogin(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(fd.get('password') ?? '').slice(0, 500);
  const next = String(fd.get('next') ?? '');
  const ip = clientIp(await headers());

  const byIp = rateLimit(`admin-login:ip:${ip}`, 20, 15 * 60_000);
  const byEmail = rateLimit(`admin-login:email:${email}`, 8, 15 * 60_000);
  if (!byIp.ok || !byEmail.ok) {
    const mins = Math.ceil(Math.max(byIp.retryAfter, byEmail.retryAfter) / 60);
    return { error: `Too many attempts. Try again in ${mins} ${mins === 1 ? 'minute' : 'minutes'}.`, email };
  }
  if (!email || !password) return { error: 'Enter your email and password.', email };

  const admin = await db.adminUser.findUnique({ where: { email } });
  const ok = await verifyPassword(password, admin?.passwordHash);
  if (!admin || !ok || !admin.active) {
    await logActivity(admin?.id ?? null, 'admin.login_failed', 'admin', admin?.id, `Failed sign in for ${email}`);
    return { error: 'That email and password do not match an active admin account.', email };
  }
  if (admin.totpEnabledAt && admin.totpSecret) {
    await startAdminSession(admin.id, { pending: true });
    redirect(`/admin/login?step=code&next=${encodeURIComponent(safeNext(next))}`);
  }
  await startAdminSession(admin.id);
  await logActivity(admin.id, 'admin.login', 'admin', admin.id, 'Signed in');
  redirect(safeNext(next));
}

export type CodeState = { error?: string };

/** Second step: the 6-digit code from the authenticator app. */
export async function adminVerifyCode(_prev: CodeState, fd: FormData): Promise<CodeState> {
  const admin = await getPendingAdmin();
  if (!admin || !admin.totpSecret) return { error: 'Your sign in timed out. Start again with your email and password.' };
  const ip = clientIp(await headers());
  const byIp = rateLimit(`admin-code:ip:${ip}`, 20, 15 * 60_000);
  const byAdmin = rateLimit(`admin-code:${admin.id}`, 6, 15 * 60_000);
  if (!byIp.ok || !byAdmin.ok) return { error: 'Too many wrong codes. Wait 15 minutes, then sign in again.' };

  const step = checkTotp(admin.totpSecret, String(fd.get('code') ?? ''));
  if (step === null || (admin.totpLastStep !== null && step <= admin.totpLastStep)) {
    await logActivity(admin.id, 'admin.code_failed', 'admin', admin.id, 'Wrong or reused sign in code');
    return { error: 'That code is not right. Check your authenticator app and use the newest code.' };
  }
  // Conditional update so the same code cannot complete two sign-ins.
  const claimed = await db.adminUser.updateMany({
    where: { id: admin.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  if (claimed.count !== 1) return { error: 'That code was just used. Wait for the next one.' };
  await completeAdminMfa();
  await logActivity(admin.id, 'admin.login', 'admin', admin.id, 'Signed in with two-step sign in');
  redirect(safeNext(String(fd.get('next') ?? '')));
}

/** "Start again" on the code step. */
export async function cancelAdminLogin() {
  await endAdminSession();
  redirect('/admin/login');
}
