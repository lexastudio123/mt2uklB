import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { startCardPayment } from '@/lib/checkout';
import { clientIp, rateLimit, sameOrigin } from '@/lib/security';
import { siteUrl } from '@/lib/site';

/** Retry card payment for an unpaid order (form post from the order page). */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const back = `${siteUrl()}/order/${encodeURIComponent(token)}`;
  if (!sameOrigin(req) || !rateLimit(`pay:${clientIp(req.headers)}`, 10, 10 * 60_000).ok) return NextResponse.redirect(back, 303);
  const order = await db.order.findUnique({ where: { accessToken: token }, select: { id: true } });
  if (!order) return NextResponse.redirect(`${siteUrl()}/`, 303);
  const r = await startCardPayment(order.id);
  return NextResponse.redirect(r.ok ? new URL(r.redirect, siteUrl()).toString() : `${back}?cancelled=1`, 303);
}
