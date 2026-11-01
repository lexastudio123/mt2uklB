'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { startAdminSession, verifyPassword } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/security';
import { logActivity } from '@/lib/activity';

export type LoginState = { error?: string; email?: string };

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
  await startAdminSession(admin.id);
  await logActivity(admin.id, 'admin.login', 'admin', admin.id, 'Signed in');
  redirect(next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin');
}
