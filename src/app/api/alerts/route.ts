import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCustomer } from '@/lib/auth';
import { EMAIL_RE } from '@/lib/site';
import { clientIp, rateLimit, sameOrigin } from '@/lib/security';

/** "Email me when it is back" on sold-out products. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad request' }, { status: 403 });
  if (!rateLimit(`alert:${clientIp(req.headers)}`, 10, 60 * 60_000).ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { email?: string; productId?: string };
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const product = await db.product.findUnique({ where: { id: String(body.productId || '') }, select: { id: true } });
  if (!product) return NextResponse.json({ error: 'Unknown product' }, { status: 404 });
  const customer = await getCustomer();
  await db.productAlert.upsert({
    where: { email_productId: { email, productId: product.id } },
    update: {},
    create: { email, productId: product.id, customerId: customer?.email === email ? customer.id : null },
  });
  return NextResponse.json({ ok: true });
}
