import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminUser, Customer } from '@prisma/client';
import { db } from './db';
import { clientIp, newToken, sha256 } from './security';
import { secureCookies } from './site';

export { hashPassword, verifyPassword, PASSWORD_MIN } from './password';

// ───────────── Customer sessions ─────────────

const CUSTOMER_COOKIE = 'mt_sid';
const CUSTOMER_DAYS = 30;

export async function startCustomerSession(customerId: string): Promise<void> {
  const token = newToken();
  const h = await headers();
  await db.session.create({
    data: {
      id: sha256(token),
      customerId,
      expiresAt: new Date(Date.now() + CUSTOMER_DAYS * 864e5),
      ip: clientIp(h),
      userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
    },
  });
  await db.customer.update({ where: { id: customerId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge: CUSTOMER_DAYS * 86400,
  });
}

/** The signed-in customer for this request, or null. */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { id: sha256(token) }, include: { customer: true } });
  if (!s || s.expiresAt < new Date() || s.customer.blocked) return null;
  return s.customer;
});

export async function endCustomerSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(CUSTOMER_COOKIE);
}

/** Sign the customer out everywhere (after a password change or reset). */
export async function endAllCustomerSessions(customerId: string, keepCurrent = false): Promise<void> {
  const token = keepCurrent ? (await cookies()).get(CUSTOMER_COOKIE)?.value : undefined;
  await db.session.deleteMany({ where: { customerId, ...(token ? { NOT: { id: sha256(token) } } : {}) } });
}

/** One-time link token (reset, magic sign-in, finish account). Returns the raw token for the email. */
export async function createAuthToken(customerId: string, kind: 'reset' | 'magic' | 'claim', minutes: number): Promise<string> {
  const token = newToken();
  await db.authToken.create({ data: { id: sha256(token), customerId, kind, expiresAt: new Date(Date.now() + minutes * 60_000) } });
  return token;
}

/** Validate a token without using it up. */
export async function peekAuthToken(token: string, kinds: string[]) {
  if (!token) return null;
  const t = await db.authToken.findUnique({ where: { id: sha256(token) }, include: { customer: true } });
  if (!t || t.usedAt || t.expiresAt < new Date() || !kinds.includes(t.kind) || t.customer.blocked) return null;
  return t;
}

/** Validate and mark a token as used. */
export async function consumeAuthToken(token: string, kinds: string[]) {
  const t = await peekAuthToken(token, kinds);
  if (!t) return null;
  const done = await db.authToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  return done.count === 1 ? t : null;
}

// ───────────── Admin sessions ─────────────

const ADMIN_COOKIE = 'mt_admin';
const ADMIN_HOURS = 12;

export type AdminRole = 'owner' | 'admin' | 'staff';
const RANK: Record<AdminRole, number> = { staff: 1, admin: 2, owner: 3 };
export const hasRole = (a: Pick<AdminUser, 'role'>, min: AdminRole) => (RANK[a.role as AdminRole] ?? 0) >= RANK[min];

export async function startAdminSession(adminId: string): Promise<void> {
  const token = newToken();
  const h = await headers();
  await db.adminSession.create({
    data: {
      id: sha256(token),
      adminId,
      expiresAt: new Date(Date.now() + ADMIN_HOURS * 36e5),
      ip: clientIp(h),
      userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
    },
  });
  await db.adminUser.update({ where: { id: adminId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_HOURS * 3600,
  });
}

export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const s = await db.adminSession.findUnique({ where: { id: sha256(token) }, include: { admin: true } });
  if (!s || s.expiresAt < new Date() || !s.admin.active) return null;
  return s.admin;
});

/** Use at the top of every admin page and server action. Redirects to the login page when signed out. */
export async function requireAdmin(min: AdminRole = 'staff'): Promise<AdminUser> {
  const a = await getAdmin();
  if (!a) redirect('/admin/login');
  if (!hasRole(a, min)) redirect('/admin?denied=1');
  return a;
}

export async function endAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { id: sha256(token) } });
  jar.delete(ADMIN_COOKIE);
}
