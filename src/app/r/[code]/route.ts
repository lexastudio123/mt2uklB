import { NextResponse } from 'next/server';
import { CODE_RE, normaliseCode } from '@/lib/affiliates';
import { siteUrl } from '@/lib/site';

/**
 * Affiliate link: /r/CODE, or /r/CODE?to=/products/melanotan-ii for a specific page.
 * Sends the visitor on with ?ref=CODE so the page can offer them the code. No cookie is set:
 * the order is credited when the code is used at checkout.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normaliseCode(decodeURIComponent((await params).code));
  const to = new URL(req.url).searchParams.get('to') || '/';
  // Only paths on this site, so the link cannot be used to bounce visitors elsewhere.
  const dest = new URL(/^\/(?![/\\])[^\s\\]*$/.test(to) ? to : '/', siteUrl());
  if (CODE_RE.test(code)) dest.searchParams.set('ref', code);
  return NextResponse.redirect(dest, { status: 302, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
