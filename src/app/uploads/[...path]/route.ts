import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { uploadDir } from '@/lib/admin/uploads';

const TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const notFound = () => new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });

/** Serves files uploaded from the admin (lot certificates, product images). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  if (!parts || parts.length !== 1) return notFound();
  const name = parts[0];
  if (!/^[a-z0-9][a-z0-9._-]{0,120}$/i.test(name) || name.includes('..')) return notFound();
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!type) return notFound();
  const dir = uploadDir();
  const file = path.join(dir, name);
  if (!file.startsWith(dir + path.sep)) return notFound();
  const data = await readFile(file).catch(() => null);
  if (!data) return notFound();
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${name}"`,
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
