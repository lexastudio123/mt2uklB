import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** Liveness check for Docker and uptime monitors. */
export async function GET() {
  try {
    await db.$queryRawUnsafe('SELECT 1');
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
