import { NextResponse } from 'next/server';
import { findLot } from '@/lib/catalog';
import { clientIp, rateLimit } from '@/lib/security';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const rl = rateLimit(`lot:${clientIp(req.headers)}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Too many lookups. Try again shortly.' }, { status: 429 });
  const { code } = await params;
  const lot = await findLot(decodeURIComponent(code).slice(0, 40));
  if (!lot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(lot);
}
