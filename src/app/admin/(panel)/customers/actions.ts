'use server';

import { db } from '@/lib/db';
import { createAuthToken } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { sendEmail } from '@/lib/email/send';
import { passwordReset } from '@/lib/email/templates';
import { siteUrl } from '@/lib/site';
import { logActivity } from '@/lib/activity';
import { m2 } from '@/lib/money';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { pounds, str } from '@/lib/admin/forms';
import { normTags } from '@/lib/admin/queries';

const path = (id: string) => `/admin/customers/${id}`;
type R = { ok?: string; err?: string };

export async function updateCustomerAction(fd: FormData) {
  const a = await requireArea('customerEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const name = str(fd, 'name', 120);
    const phone = str(fd, 'phone', 40);
    if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) throw new UserError('Enter a phone number with digits only.');
    const tags = normTags(str(fd, 'tags', 400));
    const c = await db.customer.update({ where: { id }, data: { name, phone: phone || null, tags } });
    await logActivity(a.id, 'customer.update', 'customer', id, c.email);
    r = { ok: 'Customer details saved.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function addCustomerNoteAction(fd: FormData) {
  const a = await requireArea('customers');
  const id = str(fd, 'id');
  let r: R;
  try {
    const body = str(fd, 'body', 2000);
    if (!body) throw new UserError('Write a note first.');
    await db.customerNote.create({ data: { customerId: id, adminId: a.id, body } });
    await logActivity(a.id, 'customer.note', 'customer', id, body.slice(0, 120));
    r = { ok: 'Note added.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function deleteCustomerNoteAction(fd: FormData) {
  const a = await requireArea('customers');
  const id = str(fd, 'id');
  const noteId = str(fd, 'noteId');
  let r: R;
  try {
    const n = await db.customerNote.findUniqueOrThrow({ where: { id: noteId } });
    if (n.adminId !== a.id && a.role === 'staff') throw new UserError('You can only delete your own notes.');
    await db.customerNote.delete({ where: { id: noteId } });
    await logActivity(a.id, 'customer.note_delete', 'customer', id, n.body.slice(0, 120));
    r = { ok: 'Note deleted.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function blockCustomerAction(fd: FormData) {
  const a = await requireArea('customerEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const c = await db.customer.findUniqueOrThrow({ where: { id } });
    const blocked = !c.blocked;
    await db.customer.update({ where: { id }, data: { blocked } });
    if (blocked) await db.session.deleteMany({ where: { customerId: id } });
    await logActivity(a.id, blocked ? 'customer.block' : 'customer.unblock', 'customer', id, c.email);
    r = { ok: blocked ? 'Customer blocked and signed out. They cannot sign in or use their referral code.' : 'Customer unblocked.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function adjustCreditAction(fd: FormData) {
  const a = await requireArea('customerEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const amount = pounds(fd, 'amount', { label: 'Amount' });
    const reason = str(fd, 'reason', 200);
    if (!amount) throw new UserError('Enter an amount, for example 5 or -5.');
    if (!reason) throw new UserError('Give a reason for the adjustment.');
    await db.$transaction(async (tx) => {
      const c = await tx.customer.findUniqueOrThrow({ where: { id } });
      if (c.creditPence + amount < 0) throw new UserError(`They only have ${m2(c.creditPence)} of credit.`);
      await tx.customer.update({ where: { id }, data: { creditPence: { increment: amount } } });
      await tx.creditEntry.create({ data: { customerId: id, amount, reason, adminId: a.id } });
    });
    await logActivity(a.id, 'customer.credit', 'customer', id, `${amount > 0 ? '+' : ''}${m2(amount)}: ${reason}`);
    r = { ok: `${amount > 0 ? 'Added' : 'Removed'} ${m2(Math.abs(amount))} of store credit.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

export async function sendResetAction(fd: FormData) {
  const a = await requireArea('customerEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const c = await db.customer.findUniqueOrThrow({ where: { id } });
    if (c.blocked) throw new UserError('This customer is blocked. Unblock them first.');
    const token = await createAuthToken(c.id, 'reset', 60);
    const s = await getSettings();
    const mail = passwordReset(s, `${siteUrl()}/account/reset?token=${encodeURIComponent(token)}`);
    const res = await sendEmail({ to: c.email, subject: mail.subject, html: mail.html, template: 'password_reset', customerId: c.id });
    await logActivity(a.id, 'customer.reset_email', 'customer', id, c.email);
    r = res.status === 'failed' ? { err: 'The email could not be sent. Check the email settings.' } : { ok: `Password reset link ${res.status === 'sent' ? 'sent' : 'recorded'} for ${c.email}. It expires in one hour.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}

/** Right to erasure: remove personal data but keep order totals for the accounts. */
export async function anonymiseCustomerAction(fd: FormData) {
  const a = await requireArea('customerEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    if (str(fd, 'confirm').toUpperCase() !== 'ANONYMISE') throw new UserError('Type ANONYMISE to confirm.');
    const c = await db.customer.findUniqueOrThrow({ where: { id } });
    const anon = `deleted-${c.id}@anonymised.invalid`;
    const owned = { OR: [{ customerId: id }, { email: c.email }] };
    // Removing the address of an order that still has to ship would make it impossible to send.
    const open = await db.order.findMany({ where: { ...owned, status: { in: ['awaiting_payment', 'paid', 'packed'] } }, select: { number: true } });
    if (open.length) throw new UserError(`Dispatch or cancel ${open.map((o) => o.number).join(', ')} first: ${open.length === 1 ? 'it has' : 'they have'} not shipped yet.`);
    await db.$transaction([
      db.order.updateMany({
        where: owned,
        data: { email: anon, name: 'Deleted customer', phone: null, shipLine1: 'Removed', shipLine2: null, shipCity: 'Removed', shipPostcode: 'Removed', billLine1: null, billCity: null, billPostcode: null, customerNote: null, ip: null, userAgent: null },
      }),
      db.ticketMessage.updateMany({ where: { ticket: owned }, data: { body: '[removed on request]' } }),
      db.ticket.updateMany({ where: owned, data: { email: anon, name: 'Deleted customer', status: 'closed' } }),
      db.chatConversation.updateMany({ where: { customerId: id }, data: { messages: '[]', messageCount: 0 } }),
      db.emailLog.updateMany({ where: { to: c.email }, data: { to: anon, html: null } }),
      db.subscriber.deleteMany({ where: { email: c.email } }),
      db.productAlert.deleteMany({ where: { OR: [{ customerId: id }, { email: c.email }] } }),
      db.session.deleteMany({ where: { customerId: id } }),
      db.authToken.deleteMany({ where: { customerId: id } }),
      db.address.deleteMany({ where: { customerId: id } }),
      db.customerNote.deleteMany({ where: { customerId: id } }),
      db.customer.update({ where: { id }, data: { email: anon, name: 'Deleted customer', phone: null, passwordHash: null, marketingOptIn: false, tags: 'anonymised', blocked: true } }),
    ]);
    await logActivity(a.id, 'customer.anonymise', 'customer', id, 'Personal data removed');
    r = { ok: 'Personal data removed. Order totals are kept for the accounts.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(path(id), r);
}
