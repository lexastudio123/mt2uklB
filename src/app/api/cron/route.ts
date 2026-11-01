import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expireStaleOrders } from '@/lib/orders';
import { safeEqual } from '@/lib/security';

/**
 * Hourly housekeeping: cancels expired unpaid orders (returning their stock) and clears old sessions.
 * Call with ?key=CRON_SECRET, e.g. from crontab: curl -fsS "https://yourdomain/api/cron?key=..."
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(req.url).searchParams.get('key') || req.headers.get('x-cron-key') || '';
  if (!secret || !safeEqual(key, secret)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const now = new Date();
  const expired = await expireStaleOrders(true);
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const adminSessions = await db.adminSession.deleteMany({ where: { expiresAt: { lt: now } } });
  const tokens = await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 864e5) } } });
  const chats = await db.chatConversation.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - 365 * 864e5) } } });
  return NextResponse.json({ ok: true, expiredOrders: expired, sessions: sessions.count + adminSessions.count, tokens: tokens.count, chats: chats.count });
}
