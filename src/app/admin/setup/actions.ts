'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { ADMIN_PASSWORD_MIN, consumeAdminToken, hashPassword, peekAdminToken, startAdminSession } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/security';
import { logActivity } from '@/lib/activity';

export type SetupState = { error?: string };

export async function setAdminPassword(_prev: SetupState, fd: FormData): Promise<SetupState> {
  if (!rateLimit(`admin-setup:${clientIp(await headers())}`, 10, 15 * 60_000).ok) return { error: 'Too many attempts. Wait 15 minutes and try again.' };
  const token = String(fd.get('token') ?? '');
  const password = String(fd.get('password') ?? '').slice(0, 500);
  const confirm = String(fd.get('confirm') ?? '').slice(0, 500);
  const peek = await peekAdminToken(token);
  if (!peek) return { error: 'This link has been used or has expired. Make a new one on the server.' };
  if (password.length < ADMIN_PASSWORD_MIN) return { error: `Use at least ${ADMIN_PASSWORD_MIN} characters.` };
  if (password !== confirm) return { error: 'The two passwords do not match.' };
  if (password.toLowerCase() === peek.admin.email) return { error: 'Choose a password that is not your email address.' };

  const t = await consumeAdminToken(token);
  if (!t) return { error: 'This link has been used or has expired. Make a new one on the server.' };
  await db.adminUser.update({
    where: { id: t.adminId },
    data: { passwordHash: await hashPassword(password), ...(t.kind === 'recover' ? { totpSecret: null, totpEnabledAt: null, totpLastStep: null } : {}) },
  });
  // Whoever had the old password is signed out everywhere.
  await db.adminSession.deleteMany({ where: { adminId: t.adminId } });
  await db.adminToken.deleteMany({ where: { adminId: t.adminId, usedAt: null } });
  await logActivity(t.adminId, t.kind === 'setup' ? 'account.setup' : 'account.recover', 'admin', t.adminId, t.kind === 'setup' ? 'Chose a password from a setup link' : 'Reset password and two-step sign in from a server link');
  await startAdminSession(t.adminId);
  redirect(`/admin/account?ok=${encodeURIComponent('Your password is saved. Next, turn on two-step sign in below.')}`);
}
