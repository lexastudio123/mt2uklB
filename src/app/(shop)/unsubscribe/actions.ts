'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export async function unsubscribe(fd: FormData) {
  const t = String(fd.get('t') || '');
  const sub = t ? await db.subscriber.findUnique({ where: { token: t } }) : null;
  if (sub) {
    await db.subscriber.update({ where: { id: sub.id }, data: { unsubscribedAt: sub.unsubscribedAt ?? new Date() } });
    await db.customer.updateMany({ where: { email: sub.email }, data: { marketingOptIn: false } });
    await db.productAlert.deleteMany({ where: { email: sub.email } });
  }
  redirect(`/unsubscribe?t=${encodeURIComponent(t)}&done=1`);
}
