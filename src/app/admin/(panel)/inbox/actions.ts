'use server';

import { db } from '@/lib/db';
import { addTeamReply } from '@/lib/tickets';
import { logActivity } from '@/lib/activity';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { str } from '@/lib/admin/forms';

const path = (id: string) => `/admin/inbox/${id}`;
const STATUSES = ['open', 'pending', 'closed'] as const;
type Status = (typeof STATUSES)[number];
const asStatus = (s: string): Status => (STATUSES.includes(s as Status) ? (s as Status) : 'pending');

export async function replyAction(fd: FormData) {
  const a = await requireArea('inbox');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const body = str(fd, 'body', 8000);
    if (body.length < 2) throw new UserError('Write a reply first.');
    const status = asStatus(str(fd, 'status'));
    const res = await addTeamReply(id, body, { id: a.id, name: a.name }, status);
    await logActivity(a.id, 'ticket.reply', 'ticket', id, `${res.ticket.ref}: ${body.slice(0, 100)}`);
    r =
      res.email === 'failed'
        ? { err: 'Reply saved, but the email failed to send. Check the email settings.' }
        : { ok: res.email === 'sent' ? `Reply emailed to ${res.ticket.email}.` : 'Reply saved. Email sending is not set up yet, so it was recorded in Emails instead.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function ticketStatusAction(fd: FormData) {
  const a = await requireArea('inbox');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const status = asStatus(str(fd, 'status'));
    const t = await db.ticket.update({ where: { id }, data: { status } });
    await logActivity(a.id, 'ticket.status', 'ticket', id, `${t.ref}: ${status}`);
    r = { ok: status === 'closed' ? 'Conversation closed.' : status === 'open' ? 'Conversation reopened.' : 'Marked as waiting on the customer.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function assignAction(fd: FormData) {
  const a = await requireArea('inbox');
  const id = str(fd, 'id');
  let r: { ok?: string; err?: string };
  try {
    const to = str(fd, 'assignee');
    if (to && !(await db.adminUser.findFirst({ where: { id: to, active: true } }))) throw new UserError('Choose an active team member.');
    const t = await db.ticket.update({ where: { id }, data: { assigneeId: to || null }, include: { assignee: { select: { name: true } } } });
    await logActivity(a.id, 'ticket.assign', 'ticket', id, `${t.ref} → ${t.assignee?.name ?? 'nobody'}`);
    r = { ok: t.assignee ? `Assigned to ${t.assignee.name}.` : 'Unassigned.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}
