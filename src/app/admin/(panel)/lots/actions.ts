'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { sendEmail } from '@/lib/email/send';
import { lotAlert } from '@/lib/email/templates';
import { siteUrl } from '@/lib/site';
import { logActivity } from '@/lib/activity';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { bool, dateOnly, str } from '@/lib/admin/forms';
import { removeUpload, saveUpload } from '@/lib/admin/uploads';

type R = { ok?: string; err?: string };
const path = (id: string) => `/admin/lots/${id}`;

const num = (label: string, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => !v || (/^\d+(\.\d{1,3})?$/.test(v) && Number(v) <= max), `${label} must be a number`);

const lotSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{2,30}$/, 'Lot codes use letters, numbers and dashes, like MT2-2611'),
  productId: z.string().min(1, 'Choose the product'),
  purity: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}(\.\d{1,3})?$/.test(v) && Number(v) > 0 && Number(v) <= 100, 'Purity must be a percentage, like 99.42'),
  massDa: num('Molecular mass', 100000),
  content: z.string().trim().max(40),
  endotoxin: z.string().trim().max(40),
  retention: num('Retention time', 120),
  lab: z.string().trim().max(120),
  notes: z.string().trim().max(2000),
});

async function readLot(fd: FormData) {
  const d = lotSchema.parse(Object.fromEntries(['code', 'productId', 'purity', 'massDa', 'content', 'endotoxin', 'retention', 'lab', 'notes'].map((k) => [k, String(fd.get(k) ?? '')])));
  const testedAt = dateOnly(fd, 'testedAt');
  if (!testedAt) throw new UserError('Enter the test date.');
  if (+testedAt > Date.now() + 864e5) throw new UserError('The test date cannot be in the future.');
  const product = await db.product.findUnique({ where: { id: d.productId } });
  if (!product) throw new UserError('Choose the product.');
  if (product.kind === 'bundle') throw new UserError('Lots belong to single products. A bundle shows its components’ lots.');
  return {
    code: d.code,
    productId: d.productId,
    purity: d.purity,
    massDa: d.massDa || null,
    content: d.content || null,
    endotoxin: d.endotoxin || null,
    retention: d.retention || null,
    lab: d.lab || null,
    notes: d.notes || null,
    testedAt,
    isPublished: bool(fd, 'isPublished'),
    isSample: bool(fd, 'isSample'),
  };
}

async function setCurrent(lotId: string, productId: string) {
  await db.$transaction([
    db.lot.updateMany({ where: { productId, isCurrent: true, NOT: { id: lotId } }, data: { isCurrent: false } }),
    db.lot.update({ where: { id: lotId }, data: { isCurrent: true, isPublished: true } }),
  ]);
}

export async function createLotAction(fd: FormData) {
  const a = await requireArea('lotEdit');
  let r: R;
  let id: string | null = null;
  try {
    const data = await readLot(fd);
    const reportUrl = await saveUpload(fd.get('certificate'), { prefix: `lot-${data.code}`, allow: ['pdf', 'png', 'jpg', 'webp'] });
    const lot = await db.lot.create({ data: { ...data, reportUrl } });
    id = lot.id;
    if (bool(fd, 'makeCurrent')) await setCurrent(lot.id, lot.productId);
    await logActivity(a.id, 'lot.create', 'lot', lot.id, `${lot.code} ${lot.purity}%`);
    r = { ok: `Lot ${lot.code} added${bool(fd, 'makeCurrent') ? ' and is now the lot shipping on the shop' : ''}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  if (id) back(path(id), r);
  back('/admin/lots/new', r);
}

export async function updateLotAction(fd: FormData) {
  const a = await requireArea('lotEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const data = await readLot(fd);
    const old = await db.lot.findUniqueOrThrow({ where: { id } });
    const reportUrl = await saveUpload(fd.get('certificate'), { prefix: `lot-${data.code}`, allow: ['pdf', 'png', 'jpg', 'webp'] });
    if (old.isCurrent && !data.isPublished) throw new UserError('The current lot must stay published. Make another lot current first.');
    const lot = await db.lot.update({ where: { id }, data: { ...data, ...(reportUrl ? { reportUrl } : {}) } });
    if (reportUrl && old.reportUrl) await removeUpload(old.reportUrl);
    if (old.productId !== lot.productId && lot.isCurrent) await setCurrent(lot.id, lot.productId);
    await logActivity(a.id, 'lot.update', 'lot', id, `${lot.code} ${lot.purity}%${reportUrl ? ', new certificate' : ''}`);
    r = { ok: `Lot ${lot.code} saved.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function makeCurrentAction(fd: FormData) {
  const a = await requireArea('lotEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const lot = await db.lot.findUniqueOrThrow({ where: { id } });
    await setCurrent(lot.id, lot.productId);
    await logActivity(a.id, 'lot.make_current', 'lot', id, lot.code);
    r = { ok: `${lot.code} is now the lot shown on the shop and the home page.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function removeCertificateAction(fd: FormData) {
  const a = await requireArea('lotEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const lot = await db.lot.findUniqueOrThrow({ where: { id } });
    await db.lot.update({ where: { id }, data: { reportUrl: null } });
    await removeUpload(lot.reportUrl);
    await logActivity(a.id, 'lot.certificate_remove', 'lot', id, lot.code);
    r = { ok: 'Certificate removed.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function deleteLotAction(fd: FormData) {
  const a = await requireArea('lotEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const lot = await db.lot.findUniqueOrThrow({ where: { id } });
    if (lot.isCurrent) throw new UserError('This is the current lot. Make another lot current before deleting it.');
    await db.lot.delete({ where: { id } });
    await removeUpload(lot.reportUrl);
    await logActivity(a.id, 'lot.delete', 'lot', id, lot.code);
    r = { ok: `Lot ${lot.code} deleted.` };
  } catch (e) {
    r = { err: errorMessage(e) };
    back(path(id), r);
  }
  back('/admin/lots', r);
}

/** Email everyone who asked for new lot alerts on this product. */
export async function notifyAlertsAction(fd: FormData) {
  const a = await requireArea('lotEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const lot = await db.lot.findUniqueOrThrow({ where: { id }, include: { product: true } });
    if (!lot.isCurrent || !lot.isPublished) throw new UserError('Only the current, published lot can be announced.');
    if (lot.isSample) throw new UserError('This lot is marked as sample data. Untick “sample data” before announcing it.');
    const alerts = await db.productAlert.findMany({ where: { productId: lot.productId }, select: { email: true } });
    if (!alerts.length) throw new UserError('Nobody has asked for alerts on this product yet.');
    const subs = new Map((await db.subscriber.findMany({ where: { email: { in: alerts.map((x) => x.email) }, unsubscribedAt: null }, select: { email: true, token: true } })).map((s) => [s.email, s.token]));
    const s = await getSettings();
    const url = `${siteUrl()}/products/${lot.product.slug}`;
    let sent = 0;
    let failed = 0;
    for (const al of alerts) {
      const token = subs.get(al.email);
      const mail = lotAlert(s, lot.product.name, url, { code: lot.code, purity: lot.purity, testedAt: lot.testedAt }, token ? `${siteUrl()}/unsubscribe?t=${token}` : undefined);
      const res = await sendEmail({ to: al.email, subject: mail.subject, html: mail.html, template: 'lot_alert' });
      if (res.ok) sent++;
      else failed++;
    }
    await logActivity(a.id, 'lot.notify', 'lot', id, `${lot.code}: ${sent} sent, ${failed} failed`);
    r = failed ? { err: `${sent} alerts sent, ${failed} failed. Check the email log.` } : { ok: `${sent} ${sent === 1 ? 'alert' : 'alerts'} sent for ${lot.code}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}
