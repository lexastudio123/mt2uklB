'use server';

import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { hashPassword, requireAdmin, verifyPassword } from '@/lib/auth';
import { sha256 } from '@/lib/security';
import { logActivity } from '@/lib/activity';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { str } from '@/lib/admin/forms';

type R = { ok?: string; err?: string };

export async function updateMyNameAction(fd: FormData) {
  const a = await requireAdmin('staff');
  let r: R;
  try {
    const name = str(fd, 'name', 80);
    if (name.length < 2) throw new UserError('Enter your name.');
    await db.adminUser.update({ where: { id: a.id }, data: { name } });
    await logActivity(a.id, 'account.name', 'admin', a.id, name);
    r = { ok: 'Name saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back('/admin/account', r);
}

export async function changeMyPasswordAction(fd: FormData) {
  const a = await requireAdmin('staff');
  let r: R;
  try {
    const current = String(fd.get('current') ?? '');
    const next = String(fd.get('next') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    if (!(await verifyPassword(current, a.passwordHash))) throw new UserError('Your current password is not right.');
    if (next.length < 10) throw new UserError('Use at least 10 characters for the new password.');
    if (next !== confirm) throw new UserError('The two new passwords do not match.');
    if (next === current) throw new UserError('Choose a password you have not used here before.');
    await db.adminUser.update({ where: { id: a.id }, data: { passwordHash: await hashPassword(next) } });
    // Sign out every other device, keep this one.
    const token = (await cookies()).get('mt_admin')?.value;
    await db.adminSession.deleteMany({ where: { adminId: a.id, ...(token ? { NOT: { id: sha256(token) } } : {}) } });
    await logActivity(a.id, 'account.password', 'admin', a.id, 'Changed own password');
    r = { ok: 'Password changed. Other devices have been signed out.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back('/admin/account', r);
}

export async function signOutEverywhereAction() {
  const a = await requireAdmin('staff');
  const token = (await cookies()).get('mt_admin')?.value;
  await db.adminSession.deleteMany({ where: { adminId: a.id, ...(token ? { NOT: { id: sha256(token) } } : {}) } });
  await logActivity(a.id, 'account.signout_others', 'admin', a.id, 'Signed out other devices');
  back('/admin/account', { ok: 'Signed out of every other device.' });
}
