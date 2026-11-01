'use server';

import { db } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { bool, dateOnly, int, pounds, str } from '@/lib/admin/forms';

type R = { ok?: string; err?: string };

async function readDiscount(fd: FormData) {
  const code = str(fd, 'code', 40).toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) throw new UserError('Codes use 3 to 40 letters, numbers, dashes or underscores, like SPRING15.');
  if (code.startsWith('MT-')) throw new UserError('Codes starting MT- are reserved for customer referral codes.');
  const kind = str(fd, 'kind') === 'fixed' ? 'fixed' : 'percent';
  const value = kind === 'percent' ? int(fd, 'value', { min: 1, max: 100, label: 'Percentage' }) : pounds(fd, 'value', { min: 1, label: 'Amount off' });
  const minSubtotal = str(fd, 'minSubtotal') ? pounds(fd, 'minSubtotal', { min: 0, label: 'Minimum spend' }) : 0;
  const maxRaw = int(fd, 'maxUses', { min: 1, max: 1_000_000, label: 'Maximum uses', optional: true });
  const startsAt = dateOnly(fd, 'startsAt');
  const endsRaw = dateOnly(fd, 'endsAt');
  // An end date covers the whole UK day.
  const endsAt = endsRaw ? new Date(+endsRaw + 12 * 36e5 - 1000) : null;
  if (startsAt && endsAt && endsAt < startsAt) throw new UserError('The end date is before the start date.');
  return {
    code,
    description: str(fd, 'description', 200) || null,
    kind,
    value,
    minSubtotal,
    firstOrderOnly: bool(fd, 'firstOrderOnly'),
    maxUses: Number.isNaN(maxRaw) ? null : maxRaw,
    startsAt: startsAt ? new Date(+startsAt - 12 * 36e5) : null,
    endsAt,
    active: bool(fd, 'active'),
  };
}

export async function createDiscountAction(fd: FormData) {
  const a = await requireArea('discounts');
  let r: R;
  let id: string | null = null;
  try {
    const data = await readDiscount(fd);
    const d = await db.discountCode.create({ data });
    id = d.id;
    await logActivity(a.id, 'discount.create', 'discount', d.id, d.code);
    r = { ok: `${d.code} created${d.active ? ' and ready to use' : ' (inactive)'}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(id ? `/admin/discounts/${id}` : '/admin/discounts/new', r);
}

export async function updateDiscountAction(fd: FormData) {
  const a = await requireArea('discounts');
  const id = str(fd, 'id');
  let r: R;
  try {
    const data = await readDiscount(fd);
    const d = await db.discountCode.update({ where: { id }, data });
    await logActivity(a.id, 'discount.update', 'discount', id, d.code);
    r = { ok: `${d.code} saved.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(`/admin/discounts/${id}`, r);
}

export async function toggleDiscountAction(fd: FormData) {
  const a = await requireArea('discounts');
  const id = str(fd, 'id');
  let r: R;
  try {
    const cur = await db.discountCode.findUniqueOrThrow({ where: { id } });
    const d = await db.discountCode.update({ where: { id }, data: { active: !cur.active } });
    await logActivity(a.id, d.active ? 'discount.activate' : 'discount.deactivate', 'discount', id, d.code);
    r = { ok: `${d.code} is now ${d.active ? 'active' : 'switched off'}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(str(fd, 'return', 200).startsWith('/admin/') ? str(fd, 'return', 200) : '/admin/discounts', r);
}

export async function deleteDiscountAction(fd: FormData) {
  const a = await requireArea('discounts');
  const id = str(fd, 'id');
  let r: R;
  try {
    const d = await db.discountCode.findUniqueOrThrow({ where: { id } });
    const used = await db.order.count({ where: { discountCode: d.code } });
    if (used) throw new UserError(`${d.code} was used on ${used} ${used === 1 ? 'order' : 'orders'}, so it is kept for the record. Switch it off instead.`);
    await db.discountCode.delete({ where: { id } });
    await logActivity(a.id, 'discount.delete', 'discount', id, d.code);
    r = { ok: `${d.code} deleted.` };
  } catch (e) {
    r = { err: errorMessage(e) };
    back(`/admin/discounts/${id}`, r);
  }
  back('/admin/discounts', r);
}
