import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings();
  if (s.noindex) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/checkout', '/basket', '/order', '/invoice', '/support', '/unsubscribe', '/api'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
