// Password hashing with scrypt (built into Node, no native add-ons).
// Kept free of Next.js imports so the seed and admin scripts can use it.
import crypto from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 64;

function scrypt(pw: string, salt: Buffer, keylen: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(pw.normalize('NFKC'), salt, keylen, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export const PASSWORD_MIN = 8;

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, KEYLEN, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Spend the same time so a missing account cannot be detected by timing.
    await scrypt(pw, crypto.randomBytes(16), KEYLEN, N, R, P);
    return false;
  }
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(pw, Buffer.from(saltB64, 'base64'), expected.length, +n, +r, +p);
  return crypto.timingSafeEqual(key, expected);
}
