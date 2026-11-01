import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/auth';
import { placeOrder, quote } from '@/lib/checkout';
import { clientIp, rateLimit, sameOrigin } from '@/lib/security';

type Body = {
  action?: 'quote' | 'place';
  lines?: { packId: string; qty: number }[];
  shippingMethodId?: string;
  code?: string;
  email?: string;
  useCredit?: boolean;
  [k: string]: unknown;
};

/** Quote (live totals with codes and delivery) or place an order. Prices always come from the database. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad request' }, { status: 403 });
  const ip = clientIp(req.headers);
  const body = (await req.json().catch(() => ({}))) as Body;
  const customer = await getCustomer();
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 30).map((l) => ({ packId: String(l.packId), qty: Number(l.qty) })) : [];

  if (body.action === 'place') {
    if (!rateLimit(`place:${ip}`, 10, 10 * 60_000).ok) return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
    try {
      const r = await placeOrder({ ...body, lines }, { customer, ip, userAgent: req.headers.get('user-agent') });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    } catch (e) {
      console.error('[checkout] place failed', e);
      return NextResponse.json({ ok: false, error: 'Something went wrong placing your order. Nothing was charged. Please try again.' }, { status: 500 });
    }
  }

  if (!rateLimit(`quote:${ip}`, 120, 60_000).ok) return NextResponse.json({ error: 'Slow down a little.' }, { status: 429 });
  const q = await quote(
    {
      lines,
      shippingMethodId: typeof body.shippingMethodId === 'string' ? body.shippingMethodId : null,
      code: typeof body.code === 'string' ? body.code.slice(0, 40) : null,
      email: typeof body.email === 'string' ? body.email.slice(0, 200) : null,
      useCredit: !!body.useCredit,
    },
    customer,
  );
  return NextResponse.json({
    lines: q.lines,
    invalid: q.invalid,
    subtotal: q.subtotal,
    full: q.full,
    shipping: q.shipping,
    freeShip: q.freeShip,
    method: q.method ? { id: q.method.id, name: q.method.name } : null,
    discount: q.discount,
    code: q.code ? (q.code.ok ? { ok: true, code: q.code.code, label: q.code.label } : { ok: false, code: q.code.code, message: q.code.message }) : null,
    credit: q.credit,
    availableCredit: q.availableCredit,
    total: q.total,
    stockIssues: q.stockIssues,
  });
}
