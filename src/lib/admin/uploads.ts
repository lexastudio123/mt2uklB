import 'server-only';
import path from 'node:path';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomCode } from '../security';
import { UserError } from './flash';

// Uploaded certificates and images live outside the app folder (UPLOAD_DIR) and are
// served by src/app/uploads/[...path]/route.ts. The file type is checked from its
// first bytes, never from the browser's claim.

export const UPLOAD_MAX = 10 * 1024 * 1024;

export type UploadKind = 'pdf' | 'png' | 'jpg' | 'webp';
const EXT: Record<UploadKind, string> = { pdf: '.pdf', png: '.png', jpg: '.jpg', webp: '.webp' };

export const uploadDir = () => path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');

function sniff(b: Buffer): UploadKind | null {
  if (b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

/** Save an uploaded File and return its public path (/uploads/...), or null when no file was chosen. */
export async function saveUpload(file: FormDataEntryValue | null, opts: { prefix: string; allow: UploadKind[] }): Promise<string | null> {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  if (file.size > UPLOAD_MAX) throw new UserError('That file is larger than 10 MB.');
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind || !opts.allow.includes(kind)) {
    throw new UserError(`That file type is not allowed. Upload ${opts.allow.map((k) => k.toUpperCase()).join(', ')}.`);
  }
  const prefix = opts.prefix.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40) || 'file';
  const name = `${prefix}-${randomCode(10, 'abcdefghjkmnpqrstuvwxyz23456789')}${EXT[kind]}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf, { mode: 0o644 });
  return `/uploads/${name}`;
}

/** Remove a previously uploaded file (ignores paths that are not ours). */
export async function removeUpload(publicPath: string | null | undefined): Promise<void> {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  const name = publicPath.slice('/uploads/'.length);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) return;
  await unlink(path.join(uploadDir(), name)).catch(() => undefined);
}
