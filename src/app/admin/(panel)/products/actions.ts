'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import { m2 } from '@/lib/money';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { bool, int, lines, pounds, slugify, str } from '@/lib/admin/forms';
import { saveUpload } from '@/lib/admin/uploads';

const path = (id: string) => `/admin/products/${id}`;
type R = { ok?: string; err?: string };

const imagePath = z
  .string()
  .trim()
  .max(300)
  .refine((v) => !v || (v.startsWith('/') && !v.startsWith('//')), 'Image paths must start with / (for example /img/mt2.webp or an uploaded /uploads/ file).');

const productSchema = z.object({
  name: z.string().trim().min(2, 'Enter a product name').max(80),
  fullName: z.string().trim().min(2, 'Enter the full name shown in the basket').max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,12}$/, 'The short code uses 2 to 12 letters, numbers or dashes, like MT2'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'The web address uses lower case letters, numbers and dashes only')
    .max(80),
  altName: z.string().trim().max(80),
  tagline: z.string().trim().max(80),
  badge: z.string().trim().max(30),
  lede: z.string().trim().max(600),
  highlights: z.string().max(1000),
  searchTerms: z.string().trim().max(400),
  image: imagePath.refine((v) => !!v, 'Choose an image (path or upload)'),
  packImage: imagePath,
  sequence: z.string().trim().max(200),
  structure: z.string().trim().max(120),
  massDa: z.string().trim().max(20),
  contentMg: z.coerce.number().int().min(1).max(10000),
  form: z.string().trim().max(160),
  vial: z.string().trim().max(160),
  storage: z.string().trim().max(160),
  seoTitle: z.string().trim().max(120),
  seoDescription: z.string().trim().max(320),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  level: z.enum(['pre', 'lic']),
  levelLabel: z.string().trim().max(120),
  what: z.string().trim().max(1500),
  findings: z.string().max(4000),
  warning: z.string().trim().max(1500),
  searchTerm: z.string().trim().max(80),
});

function fieldsOf(fd: FormData) {
  const keys = Object.keys(productSchema.shape);
  return Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? '')]));
}

export async function updateProductAction(fd: FormData) {
  const a = await requireArea('productEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const uploaded = await saveUpload(fd.get('imageFile'), { prefix: 'product', allow: ['png', 'jpg', 'webp'] });
    const uploadedPack = await saveUpload(fd.get('packImageFile'), { prefix: 'product-pack', allow: ['png', 'jpg', 'webp'] });
    const raw = fieldsOf(fd);
    if (uploaded) raw.image = uploaded;
    if (uploadedPack) raw.packImage = uploadedPack;
    const d = productSchema.parse(raw);
    const research =
      d.what || d.findings.trim() || d.warning
        ? JSON.stringify({ level: d.level, levelLabel: d.levelLabel, what: d.what, findings: lines(d.findings), warning: d.warning, searchTerm: d.searchTerm || d.name })
        : '{}';
    const p = await db.product.update({
      where: { id },
      data: {
        name: d.name,
        fullName: d.fullName,
        code: d.code,
        slug: d.slug,
        altName: d.altName || null,
        tagline: d.tagline,
        badge: d.badge || null,
        lede: d.lede,
        highlights: JSON.stringify(lines(d.highlights).slice(0, 6)),
        searchTerms: d.searchTerms,
        image: d.image,
        imageWide: bool(fd, 'imageWide'),
        packImage: d.packImage || null,
        sequence: d.sequence || null,
        structure: d.structure || null,
        massDa: d.massDa || null,
        contentMg: d.contentMg,
        form: d.form,
        vial: d.vial || null,
        storage: d.storage,
        seoTitle: d.seoTitle || null,
        seoDescription: d.seoDescription || null,
        sortOrder: d.sortOrder,
        active: bool(fd, 'active'),
        research,
      },
    });
    await logActivity(a.id, 'product.update', 'product', id, `${p.code} ${p.name}`);
    r = { ok: `${p.name} saved. The shop shows the change straight away.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function createProductAction(fd: FormData) {
  const a = await requireArea('productEdit');
  let r: R;
  let newId: string | null = null;
  try {
    const name = str(fd, 'name', 80);
    if (name.length < 2) throw new UserError('Enter a product name.');
    const code = str(fd, 'code', 12).toUpperCase();
    if (!/^[A-Z0-9-]{2,12}$/.test(code)) throw new UserError('The short code uses 2 to 12 letters, numbers or dashes, like MT2.');
    const slug = slugify(str(fd, 'slug') || name);
    if (!slug) throw new UserError('Enter a web address for the product.');
    const kind = str(fd, 'kind') === 'bundle' ? 'bundle' : 'single';
    const price = pounds(fd, 'price', { min: 1, label: 'Single price' });
    const uploaded = await saveUpload(fd.get('imageFile'), { prefix: 'product', allow: ['png', 'jpg', 'webp'] });
    const image = uploaded || str(fd, 'image', 300) || '/img/mt2.webp';
    if (!image.startsWith('/') || image.startsWith('//')) throw new UserError('Image paths must start with /.');
    const p = await db.product.create({
      data: {
        name,
        code,
        slug,
        fullName: str(fd, 'fullName', 120) || `${name} 10 mg`,
        kind,
        image,
        tagline: kind === 'bundle' ? '' : '10 mg vial · lyophilised',
        active: false,
        trackStock: kind === 'single',
        sortOrder: 50,
        packs: { create: { qty: 1, price, sortOrder: 0 } },
      },
    });
    newId = p.id;
    await logActivity(a.id, 'product.create', 'product', p.id, `${p.code} ${p.name}`);
    r = { ok: `${p.name} created as a draft. Fill in the details, then tick “Show on the shop”.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  if (newId) back(path(newId), r);
  back('/admin/products/new', r);
}

export async function savePackAction(fd: FormData) {
  const a = await requireArea('productEdit');
  const id = str(fd, 'id');
  const packId = str(fd, 'packId');
  let r: R;
  try {
    const qty = int(fd, 'qty', { min: 1, max: 100, label: 'Pack size' });
    const price = pounds(fd, 'price', { min: 1, label: 'Price' });
    const tag = str(fd, 'tag', 30) || null;
    const active = packId ? bool(fd, 'active') : true;
    if (packId) {
      const k = await db.pack.update({ where: { id: packId }, data: { qty, price, tag, active, sortOrder: qty } });
      await logActivity(a.id, 'product.pack_update', 'product', id, `${k.qty} for ${m2(k.price)}${active ? '' : ' (hidden)'}`);
      r = { ok: `Pack of ${qty} saved at ${m2(price)}.` };
    } else {
      await db.pack.create({ data: { productId: id, qty, price, tag, active: true, sortOrder: qty } });
      await logActivity(a.id, 'product.pack_add', 'product', id, `${qty} for ${m2(price)}`);
      r = { ok: `Pack of ${qty} added at ${m2(price)}.` };
    }
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function deletePackAction(fd: FormData) {
  const a = await requireArea('productEdit');
  const id = str(fd, 'id');
  const packId = str(fd, 'packId');
  let r: R;
  try {
    const k = await db.pack.findUniqueOrThrow({ where: { id: packId }, include: { _count: { select: { orderItems: true } } } });
    const others = await db.pack.count({ where: { productId: id, active: true, NOT: { id: packId } } });
    if (!others) throw new UserError('A product needs at least one pack size. Add another one first, or hide the product.');
    if (k._count.orderItems > 0) {
      await db.pack.update({ where: { id: packId }, data: { active: false } });
      r = { ok: `The pack of ${k.qty} has orders, so it was hidden instead of deleted.` };
    } else {
      await db.pack.delete({ where: { id: packId } });
      r = { ok: `Pack of ${k.qty} deleted.` };
    }
    await logActivity(a.id, 'product.pack_delete', 'product', id, `${k.qty} for ${m2(k.price)}`);
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function stockSettingsAction(fd: FormData) {
  const a = await requireArea('productEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const lowStock = int(fd, 'lowStock', { min: 0, max: 100000, label: 'Low stock level' });
    await db.product.update({ where: { id }, data: { trackStock: bool(fd, 'trackStock'), lowStock } });
    await logActivity(a.id, 'product.stock_settings', 'product', id, `track ${bool(fd, 'trackStock')}, low ${lowStock}`);
    r = { ok: 'Stock settings saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function adjustStockAction(fd: FormData) {
  const a = await requireArea('productEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const delta = int(fd, 'delta', { min: -100000, max: 100000, label: 'Change' });
    if (!delta) throw new UserError('Enter how many vials to add (or a negative number to remove).');
    const reason = ['restock', 'adjustment', 'damaged', 'count'].includes(str(fd, 'reason')) ? str(fd, 'reason') : 'adjustment';
    const note = str(fd, 'note', 200) || null;
    const p = await db.$transaction(async (tx) => {
      const u = await tx.product.update({ where: { id }, data: { stock: { increment: delta } } });
      await tx.stockMovement.create({ data: { productId: id, delta, reason, note, adminId: a.id } });
      return u;
    });
    await logActivity(a.id, 'product.stock', 'product', id, `${delta > 0 ? '+' : ''}${delta} (${reason}) → ${p.stock}`);
    r = { ok: `Stock is now ${p.stock} ${p.stock === 1 ? 'vial' : 'vials'}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function addBundleItemAction(fd: FormData) {
  const a = await requireArea('productEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const productId = str(fd, 'productId');
    const qty = int(fd, 'qty', { min: 1, max: 20, label: 'Quantity' });
    if (productId === id) throw new UserError('A bundle cannot contain itself.');
    const child = await db.product.findUniqueOrThrow({ where: { id: productId } });
    if (child.kind === 'bundle') throw new UserError('Bundles can only contain single products.');
    await db.bundleItem.upsert({ where: { bundleId_productId: { bundleId: id, productId } }, update: { qty }, create: { bundleId: id, productId, qty } });
    await logActivity(a.id, 'product.bundle_add', 'product', id, `${qty} × ${child.code}`);
    r = { ok: `${qty} × ${child.name} in the bundle.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function removeBundleItemAction(fd: FormData) {
  const a = await requireArea('productEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const itemId = str(fd, 'itemId');
    const it = await db.bundleItem.delete({ where: { id: itemId }, include: { product: { select: { code: true } } } });
    await logActivity(a.id, 'product.bundle_remove', 'product', id, it.product.code);
    r = { ok: 'Removed from the bundle.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}
