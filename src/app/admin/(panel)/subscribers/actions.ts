'use server';

import { db } from '@/lib/db';
import { newToken } from '@/lib/security';
import { EMAIL_RE } from '@/lib/site';
import { logActivity } from '@/lib/activity';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { str } from '@/lib/admin/forms';

type R = { ok?: string; err?: string };
const ret = (fd: FormData) => {
  const r = str(fd, 'return', 500);
  return r.startsWith('/admin/subscribers') ? r : '/admin/subscribers';
};

export async function addSubscriberAction(fd: FormData) {
  const a = await requireArea('subscribers');
  let r: R;
  try {
    const email = str(fd, 'email', 200).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new UserError('Enter a valid email address.');
    if (str(fd, 'consent') !== 'on') throw new UserError('Confirm the person agreed to receive emails.');
    const existing = await db.subscriber.findUnique({ where: { email } });
    if (existing && !existing.unsubscribedAt) throw new UserError(`${email} is already subscribed.`);
    if (existing) await db.subscriber.update({ where: { email }, data: { unsubscribedAt: null, source: 'admin' } });
    else await db.subscriber.create({ data: { email, source: 'admin', token: newToken(18) } });
    await db.customer.updateMany({ where: { email }, data: { marketingOptIn: true } });
    await logActivity(a.id, 'subscriber.add', 'subscriber', undefined, email);
    r = { ok: `${email} added.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(ret(fd), r);
}

export async function toggleSubscriberAction(fd: FormData) {
  const a = await requireArea('subscribers');
  let r: R;
  try {
    const id = str(fd, 'id');
    const s = await db.subscriber.findUniqueOrThrow({ where: { id } });
    const unsub = !s.unsubscribedAt;
    await db.subscriber.update({ where: { id }, data: { unsubscribedAt: unsub ? new Date() : null } });
    await db.customer.updateMany({ where: { email: s.email }, data: { marketingOptIn: !unsub } });
    await logActivity(a.id, unsub ? 'subscriber.unsubscribe' : 'subscriber.resubscribe', 'subscriber', id, s.email);
    r = { ok: unsub ? `${s.email} unsubscribed.` : `${s.email} subscribed again.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(ret(fd), r);
}

export async function deleteSubscriberAction(fd: FormData) {
  const a = await requireArea('subscribers');
  let r: R;
  try {
    const id = str(fd, 'id');
    const s = await db.subscriber.delete({ where: { id } });
    await db.customer.updateMany({ where: { email: s.email }, data: { marketingOptIn: false } });
    await logActivity(a.id, 'subscriber.delete', 'subscriber', id, s.email);
    r = { ok: `${s.email} deleted.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(ret(fd), r);
}
