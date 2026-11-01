import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Affiliate } from '@prisma/client';
import { db } from './db';
import { clientIp, newToken, sha256 } from './security';
import { secureCookies } from './site';

// Affiliate portal sessions, kept apart from customer and admin sessions.

const COOKIE = 'mt_aff';
const DAYS = 14;

/** Statuses that can sign in. Paused affiliates still see their sales and payouts. */
const CAN_SIGN_IN = ['active', 'paused'];

export async function startAffiliateSession(affiliateId: string): Promise<void> {
  const token = newToken();
  const h = await headers();
  await db.affiliateSession.create({
    data: {
      id: sha256(token),
      affiliateId,
      expiresAt: new Date(Date.now() + DAYS * 864e5),
      ip: clientIp(h),
      userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
    },
  });
  await db.affiliate.update({ where: { id: affiliateId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: secureCookies(), sameSite: 'lax', path: '/', maxAge: DAYS * 86400 });
}

/** The signed-in affiliate for this request, or null. */
export const getAffiliate = cache(async (): Promise<Affiliate | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.affiliateSession.findUnique({ where: { id: sha256(token) }, include: { affiliate: true } });
  if (!s || s.expiresAt < new Date() || !CAN_SIGN_IN.includes(s.affiliate.status)) return null;
  return s.affiliate;
});

/** Use at the top of every portal page and action. */
export async function requireAffiliate(next = '/affiliates/portal'): Promise<Affiliate> {
  const a = await getAffiliate();
  if (!a) redirect(`/affiliates/login?next=${encodeURIComponent(next)}`);
  return a;
}

export const canSignIn = (a: Pick<Affiliate, 'status' | 'passwordHash'>) => CAN_SIGN_IN.includes(a.status) && !!a.passwordHash;

export async function endAffiliateSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.affiliateSession.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

/** Sign out everywhere, e.g. after a password change, reset or when the team closes the account. */
export async function endAllAffiliateSessions(affiliateId: string, keepCurrent = false): Promise<void> {
  const token = keepCurrent ? (await cookies()).get(COOKIE)?.value : undefined;
  await db.affiliateSession.deleteMany({ where: { affiliateId, ...(token ? { NOT: { id: sha256(token) } } : {}) } });
}

/** One-time link: `invite` sets a first password (7 days), `reset` a new one (1 hour). Returns the raw token. */
export async function createAffiliateToken(affiliateId: string, kind: 'invite' | 'reset'): Promise<string> {
  const token = newToken();
  // A new link replaces any earlier unused one of the same kind.
  await db.affiliateToken.deleteMany({ where: { affiliateId, kind, usedAt: null } });
  await db.affiliateToken.create({
    data: { id: sha256(token), affiliateId, kind, expiresAt: new Date(Date.now() + (kind === 'invite' ? 7 * 864e5 : 60 * 60_000)) },
  });
  return token;
}

export async function peekAffiliateToken(token: string) {
  if (!token) return null;
  const t = await db.affiliateToken.findUnique({ where: { id: sha256(token) }, include: { affiliate: true } });
  if (!t || t.usedAt || t.expiresAt < new Date() || !CAN_SIGN_IN.includes(t.affiliate.status)) return null;
  return t;
}

export async function consumeAffiliateToken(token: string) {
  const t = await peekAffiliateToken(token);
  if (!t) return null;
  const done = await db.affiliateToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  return done.count === 1 ? t : null;
}
