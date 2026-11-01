// Time-based one-time codes (RFC 6238, the scheme used by Google Authenticator, 1Password, Authy).
// Kept free of Next.js imports so scripts can use it too.
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_MS = 30_000;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const s = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('Invalid base32 character');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit secret, as recommended by RFC 4226. */
export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const currentStep = (now = Date.now()) => Math.floor(now / STEP_MS);

export function totpCode(secret: string, step: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

/**
 * Check a 6-digit code, allowing one step either side for clock drift.
 * Returns the matching step (store it to stop the same code being used twice) or null.
 */
export function checkTotp(secret: string, code: string, now = Date.now()): number | null {
  const c = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const s = currentStep(now);
  for (const d of [0, -1, 1]) {
    const expected = totpCode(secret, s + d);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return s + d;
  }
  return null;
}

export function otpauthUrl(secret: string, account: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** "JBSW Y3DP EHPK 3PXP" for typing into an app by hand. */
export const groupSecret = (secret: string) => secret.replace(/(.{4})/g, '$1 ').trim();
