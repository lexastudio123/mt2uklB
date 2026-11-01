import 'server-only';
import { db } from './db';
import { getSettings } from './settings';
import { sendEmail } from './email/send';
import * as T from './email/templates';
import { newTicketRef } from './ids';
import { newToken } from './security';

export const TICKET_TOPICS = ['An order I placed', 'Delivery', 'Returns and refunds', 'Product information', 'Trade and bulk orders', 'Something else'];

/** Create a support conversation from the contact form or the chat assistant. */
export async function createTicket(input: {
  name: string;
  email: string;
  topic: string;
  message: string;
  orderNumber?: string | null;
  channel?: 'contact' | 'chat';
  customerId?: string | null;
}) {
  const s = await getSettings();
  const email = input.email.trim().toLowerCase();
  const customerId = input.customerId ?? (await db.customer.findUnique({ where: { email }, select: { id: true } }))?.id ?? null;
  const ticket = await db.ticket.create({
    data: {
      ref: await newTicketRef(),
      accessToken: newToken(24),
      customerId,
      email,
      name: input.name.trim(),
      topic: input.topic,
      orderNumber: input.orderNumber?.trim().toUpperCase() || null,
      channel: input.channel ?? 'contact',
      messages: { create: { author: 'customer', body: input.message.trim() } },
    },
  });
  const ack = T.ticketReceived(s, ticket);
  await sendEmail({ to: email, subject: ack.subject, html: ack.html, template: 'ticket_received', customerId });
  const team = s.notifyEmail || s.supportEmail;
  if (team && !team.endsWith('@example.co.uk')) {
    const n = T.adminNewTicket(s, ticket, input.message);
    await sendEmail({ to: team, subject: n.subject, html: n.html, template: 'team_new_ticket', replyTo: email });
  }
  return ticket;
}

/** Customer follow-up from the private conversation page. Reopens the conversation. */
export async function addCustomerReply(ticketId: string, body: string) {
  const s = await getSettings();
  const t = await db.ticket.update({
    where: { id: ticketId },
    data: { status: 'open', lastMessageAt: new Date(), messages: { create: { author: 'customer', body: body.trim() } } },
  });
  const team = s.notifyEmail || s.supportEmail;
  if (team && !team.endsWith('@example.co.uk')) {
    const n = T.adminNewTicket(s, t, body);
    await sendEmail({ to: team, subject: `Reply from ${t.name}: ${t.topic} (${t.ref})`, html: n.html, template: 'team_ticket_reply', replyTo: t.email });
  }
  return t;
}

/** Team reply: stored on the conversation and emailed to the customer. */
export async function addTeamReply(ticketId: string, body: string, admin: { id: string; name: string }, status: 'open' | 'pending' | 'closed' = 'pending') {
  const s = await getSettings();
  const t = await db.ticket.update({
    where: { id: ticketId },
    data: { status, lastMessageAt: new Date(), messages: { create: { author: 'admin', adminId: admin.id, body: body.trim() } } },
  });
  const r = T.ticketReply(s, t, body, `${admin.name.split(' ')[0]} at ${s.storeName}`);
  const res = await sendEmail({ to: t.email, subject: r.subject, html: r.html, template: 'ticket_reply', customerId: t.customerId });
  return { ticket: t, email: res.status };
}
