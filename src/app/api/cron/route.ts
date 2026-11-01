import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expireStaleOrders } from '@/lib/orders';
import { approveDueCommissions } from '@/lib/affiliates';
import { safeEqual } from '@/lib/security';

/**
 * Hourly housekeeping: cancels expired unpaid orders (returning their stock), approves affiliate
 * commission whose hold period has ended, and clears old sessions, links and click records.
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
  const affiliateSessions = await db.affiliateSession.deleteMany({ where: { expiresAt: { lt: now } } });
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const tokens = await db.authToken.deleteMany({ where: { expiresAt: { lt: weekAgo } } });
  const affiliateTokens = await db.affiliateToken.deleteMany({ where: { expiresAt: { lt: weekAgo } } });
  const adminTokens = await db.adminToken.deleteMany({ where: { expiresAt: { lt: weekAgo } } });
  const chats = await db.chatConversation.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - 365 * 864e5) } } });
  const clicks = await db.affiliateClick.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 400 * 864e5) } } });
  const approved = await approveDueCommissions(true);
  return NextResponse.json({
    ok: true,
    expiredOrders: expired,
    commissionApproved: approved,
    sessions: sessions.count + adminSessions.count + affiliateSessions.count,
    tokens: tokens.count + affiliateTokens.count + adminTokens.count,
    chats: chats.count,
    clicks: clicks.count,
  });
}
