import 'server-only';
import crypto from 'node:crypto';

// Field encryption for sensitive values such as affiliate bank details (AES-256-GCM).
// Turn it on by setting ENCRYPTION_KEY to a long random string. Values saved before the key
// was set stay readable and are encrypted the next time they are saved.
// Keep the key safe and backed up: without it, encrypted values cannot be read back.

const PREFIX = 'enc1:';

function key(): Buffer | null {
  const k = process.env.ENCRYPTION_KEY;
  return k && k.length >= 16 ? crypto.createHash('sha256').update(k).digest() : null;
}

export const encryptionOn = () => key() !== null;

export function seal(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const k = key();
  if (!k) return value;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([c.update(value, 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}

/** Read a value written by seal(). Undefined means it is encrypted and the key is missing or has changed. */
export function unseal(value: string | null | undefined): string | null | undefined {
  if (value == null || value === '') return null;
  if (!value.startsWith(PREFIX)) return value;
  const k = key();
  if (!k) return undefined;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', k, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}
