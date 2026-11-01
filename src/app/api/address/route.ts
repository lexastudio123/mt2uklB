import { NextResponse } from 'next/server';
import { UK_POSTCODE_RE, formatPostcode } from '@/lib/site';
import { clientIp, rateLimit } from '@/lib/security';
import { getConnections } from '@/lib/connections';

/** UK address lookup through Ideal Postcodes (optional; add the key in Admin › Settings › Connections). */
export async function GET(req: Request) {
  const key = (await getConnections()).postcodesKey;
  if (!key) return NextResponse.json({ error: 'Address lookup is not available.' }, { status: 404 });
  if (!rateLimit(`addr:${clientIp(req.headers)}`, 20, 10 * 60_000).ok) return NextResponse.json({ error: 'Too many lookups. Type your address instead.' }, { status: 429 });
  const pc = new URL(req.url).searchParams.get('postcode')?.trim().toUpperCase() || '';
  if (!UK_POSTCODE_RE.test(pc)) return NextResponse.json({ error: 'Enter a full UK postcode.' }, { status: 400 });
  try {
    const r = await fetch(`https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(pc.replace(/\s+/g, ''))}?api_key=${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (r.status === 404) return NextResponse.json({ addresses: [], error: 'No addresses found for that postcode.' });
    const j = (await r.json()) as { result?: { line_1: string; line_2: string; line_3: string; post_town: string; postcode: string }[] };
    const addresses = (j.result ?? []).slice(0, 100).map((a) => {
      const line2 = [a.line_2, a.line_3].filter(Boolean).join(', ');
      const city = a.post_town ? a.post_town.charAt(0) + a.post_town.slice(1).toLowerCase() : '';
      const postcode = formatPostcode(a.postcode || pc);
      return { line1: a.line_1, line2, city, postcode, label: [a.line_1, line2, city, postcode].filter(Boolean).join(', ') };
    });
    return NextResponse.json({ addresses });
  } catch {
    return NextResponse.json({ error: 'Lookup is unavailable. Type your address instead.' }, { status: 502 });
  }
}
