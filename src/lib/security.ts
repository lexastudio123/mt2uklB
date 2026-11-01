import 'server-only';
import crypto from 'node:crypto';

/** Client IP from the reverse proxy headers (Caddy, Nginx, Cloudflare). Used for rate limits and logs only. */
export function clientIp(h: Headers): string {
  const fwd = h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || '';
  return fwd.trim().slice(0, 64) || 'unknown';
}

type Bucket = { n: number; reset: number };
const g = globalThis as unknown as { __rl?: Map<string, Bucket> };
const buckets = (g.__rl ??= new Map());

/**
 * Fixed-window rate limiter kept in memory. Fine for one server process;
 * use a shared store such as Redis if you run several instances.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset <= now) {
    b = { n: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.n++;
  if (buckets.size > 20000) {
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
  return { ok: b.n <= limit, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
}

/** Reject cross-site POSTs to route handlers (server actions are checked by Next.js itself). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return req.method === 'GET' || req.method === 'HEAD';
  try {
    const o = new URL(origin);
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    return o.host === host;
  } catch {
    return false;
  }
}

export const newToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Random string from an alphabet without look-alike characters. */
export function randomCode(len: number, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'): string {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

export const randomDigits = (len: number) => randomCode(len, '0123456789');
