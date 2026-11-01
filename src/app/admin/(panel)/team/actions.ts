'use server';

import { db } from '@/lib/db';
import { ADMIN_PASSWORD_MIN, hashPassword } from '@/lib/auth';
import { EMAIL_RE } from '@/lib/site';
import { logActivity } from '@/lib/activity';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { str } from '@/lib/admin/forms';

type R = { ok?: string; err?: string };
const ROLES = ['owner', 'admin', 'staff'];

async function otherActiveOwners(id: string) {
  return db.adminUser.count({ where: { role: 'owner', active: true, NOT: { id } } });
}

export async function addAdminAction(fd: FormData) {
  const a = await requireArea('team');
  let r: R;
  try {
    const name = str(fd, 'name', 80);
    const email = str(fd, 'email', 200).toLowerCase();
    const role = str(fd, 'role');
    const password = String(fd.get('password') ?? '');
    if (name.length < 2) throw new UserError('Enter their name.');
    if (!EMAIL_RE.test(email)) throw new UserError('Enter a valid email address.');
    if (!ROLES.includes(role)) throw new UserError('Choose a role.');
    if (password.length < ADMIN_PASSWORD_MIN) throw new UserError(`The temporary password needs at least ${ADMIN_PASSWORD_MIN} characters.`);
    if (await db.adminUser.findUnique({ where: { email } })) throw new UserError('Someone on the team already uses that email.');
    const u = await db.adminUser.create({ data: { name, email, role, passwordHash: await hashPassword(password) } });
    await logActivity(a.id, 'team.add', 'admin', u.id, `${email} as ${role}`);
    r = { ok: `${name} can now sign in at /admin/login. Share the temporary password privately and ask them to change it under “Your account”.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back('/admin/team', r);
}

export async function changeRoleAction(fd: FormData) {
  const a = await requireArea('team');
  let r: R;
  try {
    const id = str(fd, 'id');
    const role = str(fd, 'role');
    if (!ROLES.includes(role)) throw new UserError('Choose a role.');
    const u = await db.adminUser.findUniqueOrThrow({ where: { id } });
    if (u.role === 'owner' && role !== 'owner' && (await otherActiveOwners(id)) === 0) throw new UserError('The shop needs at least one active owner.');
    await db.adminUser.update({ where: { id }, data: { role } });
    await logActivity(a.id, 'team.role', 'admin', id, `${u.email}: ${u.role} → ${role}`);
    r = { ok: `${u.name} is now ${role === 'owner' ? 'an owner' : role === 'admin' ? 'an admin' : 'staff'}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back('/admin/team', r);
}

export async function toggleAdminAction(fd: FormData) {
  const a = await requireArea('team');
  let r: R;
  try {
    const id = str(fd, 'id');
    if (id === a.id) throw new UserError('You cannot deactivate yourself.');
    const u = await db.adminUser.findUniqueOrThrow({ where: { id } });
    const active = !u.active;
    if (!active && u.role === 'owner' && (await otherActiveOwners(id)) === 0) throw new UserError('The shop needs at least one active owner.');
    await db.adminUser.update({ where: { id }, data: { active } });
    if (!active) await db.adminSession.deleteMany({ where: { adminId: id } });
    await logActivity(a.id, active ? 'team.reactivate' : 'team.deactivate', 'admin', id, u.email);
    r = { ok: active ? `${u.name} can sign in again.` : `${u.name} is deactivated and signed out everywhere.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back('/admin/team', r);
}

export async function resetAdminPasswordAction(fd: FormData) {
  const a = await requireArea('team');
  let r: R;
  try {
    const id = str(fd, 'id');
    const password = String(fd.get('password') ?? '');
    if (password.length < ADMIN_PASSWORD_MIN) throw new UserError(`The new password needs at least ${ADMIN_PASSWORD_MIN} characters.`);
    const u = await db.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
    if (id !== a.id) await db.adminSession.deleteMany({ where: { adminId: id } });
    // An unused setup link would otherwise still let someone choose a different password.
    await db.adminToken.deleteMany({ where: { adminId: id, usedAt: null } });
    await logActivity(a.id, 'team.reset_password', 'admin', id, u.email);
    r = { ok: `Password changed for ${u.name}${id !== a.id ? ', who has been signed out' : ''}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back('/admin/team', r);
}

/** For a teammate who lost their phone: they sign in with just their password and can set it up again. */
export async function resetTwoStepAction(fd: FormData) {
  const a = await requireArea('team');
  let r: R;
  try {
    const id = str(fd, 'id');
    const u = await db.adminUser.findUniqueOrThrow({ where: { id } });
    await db.adminUser.update({ where: { id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } });
    await db.adminSession.deleteMany({ where: { adminId: id } });
    await logActivity(a.id, 'team.2fa_reset', 'admin', id, u.email);
    r = { ok: `Two-step sign in reset for ${u.name}. They can sign in with their password and set it up again under “Your account”.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back('/admin/team', r);
}
