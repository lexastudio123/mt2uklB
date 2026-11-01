import type { MetadataRoute } from 'next';
import { getCatalog, getPublishedLots } from '@/lib/catalog';
import { siteUrl } from '@/lib/site';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [catalog, lots, s] = await Promise.all([getCatalog(), getPublishedLots(), getSettings()]);
  const pages = ['', '/shop', '/science', '/lot-reports', '/help', '/delivery', '/returns', '/about', '/contact', '/terms', '/privacy', '/cookies'];
  if (s.affiliates.enabled) pages.push('/affiliates', '/affiliates/terms', ...(s.affiliates.applicationsOpen ? ['/affiliates/apply'] : []));
  return [
    ...pages.map((p) => ({ url: base + p, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 })),
    ...catalog.map((p) => ({ url: base + p.href, changeFrequency: 'weekly' as const, priority: 0.9 })),
    ...lots.map((l) => ({ url: `${base}/lot-reports/${l.code}`, lastModified: new Date(l.testedAt), priority: 0.4 })),
  ];
}
