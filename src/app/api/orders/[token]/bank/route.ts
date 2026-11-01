import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { switchToBankTransfer } from '@/lib/checkout';
import { sameOrigin } from '@/lib/security';
import { siteUrl } from '@/lib/site';

/** Switch an unpaid card order to bank transfer (form post from the order page). */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const back = `${siteUrl()}/order/${encodeURIComponent(token)}`;
  if (!sameOrigin(req)) return NextResponse.redirect(back, 303);
  const order = await db.order.findUnique({ where: { accessToken: token }, select: { id: true } });
  if (order) await switchToBankTransfer(order.id);
  return NextResponse.redirect(back, 303);
}
