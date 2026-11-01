'use server';

import { headers } from 'next/headers';
import { getCustomer } from '@/lib/auth';
import { createTicket, TICKET_TOPICS } from '@/lib/tickets';
import { clientIp, rateLimit } from '@/lib/security';
import { EMAIL_RE } from '@/lib/site';

type Values = { name: string; email: string; topic: string; order: string; message: string };
export type ContactState = { ok?: boolean; ref?: string; error?: string; errors?: Partial<Record<keyof Values, string>>; values?: Values };

export async function sendContact(_prev: ContactState, fd: FormData): Promise<ContactState> {
  const values: Values = {
    name: String(fd.get('name') || '').trim().slice(0, 120),
    email: String(fd.get('email') || '').trim().slice(0, 200),
    topic: String(fd.get('topic') || ''),
    order: String(fd.get('order') || '').trim().toUpperCase().slice(0, 12),
    message: String(fd.get('message') || '').trim().slice(0, 5000),
  };
  if (String(fd.get('website') || '')) return { ok: true, ref: 'received' }; // bot
  const errors: ContactState['errors'] = {};
  if (!values.name) errors.name = 'Enter your name';
  if (!EMAIL_RE.test(values.email)) errors.email = 'Enter an email we can reply to';
  if (values.message.length < 10) errors.message = 'Tell us a little more, at least 10 characters';
  if (Object.keys(errors).length) return { errors, values };
  if (!rateLimit(`contact:${clientIp(await headers())}`, 5, 60 * 60_000).ok) return { error: 'You have sent a few messages already. Please wait a little before sending another.', values };

  const me = await getCustomer();
  const ticket = await createTicket({
    name: values.name,
    email: values.email,
    topic: TICKET_TOPICS.includes(values.topic) ? values.topic : 'Something else',
    orderNumber: values.order || null,
    message: values.message,
    customerId: me && me.email === values.email.toLowerCase() ? me.id : null,
  });
  return { ok: true, ref: ticket.ref };
}
