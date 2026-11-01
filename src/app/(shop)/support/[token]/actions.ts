'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { addCustomerReply } from '@/lib/tickets';
import { clientIp, rateLimit } from '@/lib/security';

export type ReplyState = { error?: string; sentAt?: number };

export async function replyToTicket(_prev: ReplyState, fd: FormData): Promise<ReplyState> {
  const token = String(fd.get('token') || '');
  const body = String(fd.get('body') || '').trim().slice(0, 5000);
  if (body.length < 2) return { error: 'Write a reply first' };
  if (!rateLimit(`ticket-reply:${clientIp(await headers())}`, 10, 30 * 60_000).ok) return { error: 'Please wait a little before sending another reply.' };
  const t = await db.ticket.findUnique({ where: { accessToken: token }, select: { id: true } });
  if (!t) return { error: 'This conversation could not be found.' };
  await addCustomerReply(t.id, body);
  revalidatePath(`/support/${token}`);
  return { sentAt: Date.now() };
}
