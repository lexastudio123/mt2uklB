/** Public base URL without a trailing slash. */
export function siteUrl(): string {
  return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** Cookies are marked Secure whenever the site is served over HTTPS. */
export const secureCookies = () => siteUrl().startsWith('https://');

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
export const ORDER_NO_RE = /^MT\d{5,6}$/;

/** "sw1a1aa" → "SW1A 1AA" */
export function formatPostcode(pc: string): string {
  const s = pc.toUpperCase().replace(/\s+/g, '');
  return s.length > 3 ? `${s.slice(0, -3)} ${s.slice(-3)}` : s;
}

export function royalMailTrackingUrl(n: string) {
  return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(n)}`;
}
