import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { sendEmail } from '@/lib/email/send';
import { welcomeCode } from '@/lib/email/templates';
import { EMAIL_RE, siteUrl } from '@/lib/site';
import { clientIp, newToken, rateLimit, sameOrigin } from '@/lib/security';

const SOURCES = new Set(['footer', 'popup', 'account']);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad request' }, { status: 403 });
  const rl = rateLimit(`sub:${clientIp(req.headers)}`, 6, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Too many sign ups from this connection. Try again later.' }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { email?: string; source?: string };
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const source = SOURCES.has(String(body.source)) ? String(body.source) : 'footer';

  const existing = await db.subscriber.findUnique({ where: { email } });
  const sub = existing
    ? await db.subscriber.update({ where: { email }, data: { unsubscribedAt: null } })
    : await db.subscriber.create({ data: { email, source, token: newToken(18) } });
  await db.customer.updateMany({ where: { email }, data: { marketingOptIn: true } });

  // Send the welcome code once per address.
  if (!existing) {
    const s = await getSettings();
    const r = welcomeCode(s, s.marketing.welcomeCode, s.marketing.welcomePct, `${siteUrl()}/unsubscribe?t=${sub.token}`);
    await sendEmail({ to: email, subject: r.subject, html: r.html, template: 'welcome_code' });
  }
  return NextResponse.json({ ok: true });
}
