import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { activeAffiliateByCode, normaliseCode } from '@/lib/affiliates';
import { clientIp, rateLimit } from '@/lib/security';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python|headless/i;

/**
 * Is this an active affiliate code, and what does it give? Used by the partner offer bar.
 * With visit=1 it also counts a visit for the affiliate's stats: at most one per visitor and
 * affiliate every 30 minutes (tracked in memory only; no IP address or cookie is stored).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ip = clientIp(req.headers);
  if (!rateLimit(`afflookup:${ip}`, 40, 10 * 60_000).ok) return NextResponse.json({ ok: false }, { status: 429 });
  const a = await activeAffiliateByCode(normaliseCode(u.searchParams.get('code') || ''));
  if (!a) return NextResponse.json({ ok: false }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  if (u.searchParams.get('visit') === '1' && !BOT.test(req.headers.get('user-agent') || '') && rateLimit(`affvisit:${a.id}:${ip}`, 1, 30 * 60_000).ok) {
    const land = (u.searchParams.get('land') || '/').slice(0, 200);
    const from = (u.searchParams.get('from') || '').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 120);
    await db.affiliateClick.create({ data: { affiliateId: a.id, landing: land.startsWith('/') ? land : '/', referrer: from || null } });
  }
  return NextResponse.json({ ok: true, code: a.code, discountPct: a.customerDiscountPct }, { headers: { 'Cache-Control': 'no-store' } });
}
