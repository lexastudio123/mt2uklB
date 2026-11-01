'use server';

import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { EMAIL_RE, siteUrl } from '@/lib/site';
import { logActivity } from '@/lib/activity';
import { requireArea } from '@/lib/admin/perms';
import { back, errorMessage, UserError } from '@/lib/admin/flash';
import { bool, dateOnly, optStr, pounds, str } from '@/lib/admin/forms';
import * as T from '@/lib/email/templates';
import { createAffiliateToken, endAllAffiliateSessions } from '@/lib/affiliate-auth';
import {
  AffiliateError,
  cleanBank,
  codeProblem,
  createPayout,
  normaliseCode,
  sealBank,
  sendAffiliateEmail,
  syncCommission,
  toBps,
  undoPayout,
} from '@/lib/affiliates';
import { m2 } from '@/lib/money';

type R = { ok?: string; err?: string };
const page = (id: string, hash = '') => `/admin/affiliates/${id}${hash}`;

function percent(fd: FormData, k: string, label: string, max = 50): number {
  const n = Number(str(fd, k, 10).replace('%', ''));
  if (!Number.isFinite(n) || n < 0 || n > max) throw new UserError(`${label} must be between 0% and ${max}%.`);
  return n;
}

/** Profile fields shared by "Add affiliate" and the details form. */
async function readProfile(fd: FormData, exceptId?: string) {
  const name = str(fd, 'name', 120);
  if (name.length < 2) throw new UserError('Enter their name.');
  const email = str(fd, 'email', 200).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new UserError('Enter an email address like name@example.com.');
  const clash = await db.affiliate.findUnique({ where: { email }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw new UserError('Another affiliate already uses that email address.');
  const code = normaliseCode(str(fd, 'code', 40));
  const problem = await codeProblem(code, exceptId);
  if (problem) throw new UserError(problem);
  const discount = percent(fd, 'discountPct', 'Customer discount');
  if (!Number.isInteger(discount)) throw new UserError('Customer discount must be a whole number.');
  return {
    name,
    email,
    code,
    commissionBps: toBps(percent(fd, 'commissionPct', 'Commission')),
    customerDiscountPct: discount,
    phone: optStr(fd, 'phone', 40),
    company: optStr(fd, 'company', 120),
    website: optStr(fd, 'website', 300),
    socials: optStr(fd, 'socials', 1000),
    addressLine1: optStr(fd, 'addressLine1', 150),
    addressLine2: optStr(fd, 'addressLine2', 150),
    city: optStr(fd, 'city', 80),
    postcode: optStr(fd, 'postcode', 12)?.toUpperCase() ?? null,
    country: str(fd, 'country', 60) || 'United Kingdom',
    taxRef: optStr(fd, 'taxRef', 40),
    notes: optStr(fd, 'notes', 4000),
    notifySales: bool(fd, 'notifySales'),
  };
}

async function sendInvite(affiliateId: string): Promise<string> {
  const [a, s] = await Promise.all([db.affiliate.findUniqueOrThrow({ where: { id: affiliateId } }), getSettings()]);
  if (a.passwordHash) {
    const token = await createAffiliateToken(a.id, 'reset');
    await sendAffiliateEmail(a, T.affiliateReset(s, `${siteUrl()}/affiliates/password?token=${token}`), 'affiliate_reset');
    return `Password reset link sent to ${a.email}.`;
  }
  const token = await createAffiliateToken(a.id, 'invite');
  await sendAffiliateEmail(a, T.affiliateApproved(s, a, `${siteUrl()}/affiliates/password?token=${token}`), 'affiliate_invite');
  return `Welcome email with a link to choose a password sent to ${a.email}.`;
}

export async function createAffiliateAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  let r: R;
  let id: string | null = null;
  try {
    const data = await readProfile(fd);
    const bank = cleanBank({ accountName: str(fd, 'bankAccountName', 120), sortCode: str(fd, 'bankSortCode', 20), accountNumber: str(fd, 'bankAccountNumber', 20), iban: str(fd, 'bankIban', 40), bic: str(fd, 'bankBic', 20) });
    if (!bank.ok) throw new UserError(bank.error);
    const hasBank = !!bank.bank.accountName;
    const a = await db.affiliate.create({
      data: { ...data, ...(hasBank ? { ...sealBank(bank.bank), bankUpdatedAt: new Date() } : {}), status: 'active', approvedAt: new Date() },
    });
    id = a.id;
    await logActivity(admin.id, 'affiliate.create', 'affiliate', a.id, `${a.name} (${a.code})`);
    r = { ok: `${a.name} added with code ${a.code}.${bool(fd, 'invite') ? ' ' + (await sendInvite(a.id)) : ''}` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(id ? page(id) : '/admin/affiliates/new', r);
}

export async function updateAffiliateAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const before = await db.affiliate.findUniqueOrThrow({ where: { id } });
    const data = await readProfile(fd, id);
    const a = await db.affiliate.update({ where: { id }, data });
    const changes = [
      before.code !== a.code && `code ${before.code} → ${a.code}`,
      before.commissionBps !== a.commissionBps && `commission ${before.commissionBps / 100}% → ${a.commissionBps / 100}%`,
      before.customerDiscountPct !== a.customerDiscountPct && `discount ${before.customerDiscountPct}% → ${a.customerDiscountPct}%`,
      before.email !== a.email && `email ${before.email} → ${a.email}`,
    ].filter(Boolean);
    await logActivity(admin.id, 'affiliate.update', 'affiliate', id, changes.join(', ') || a.name);
    r = { ok: `Saved.${before.commissionBps !== a.commissionBps ? ' The new rate applies to sales from now on.' : ''}` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id), r);
}

export async function updateAffiliateBankAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const bank = cleanBank({ accountName: str(fd, 'bankAccountName', 120), sortCode: str(fd, 'bankSortCode', 20), accountNumber: str(fd, 'bankAccountNumber', 20), iban: str(fd, 'bankIban', 40), bic: str(fd, 'bankBic', 20) });
    if (!bank.ok) throw new UserError(bank.error);
    await db.affiliate.update({ where: { id }, data: { ...sealBank(bank.bank), bankUpdatedAt: new Date() } });
    await logActivity(admin.id, 'affiliate.bank_update', 'affiliate', id, bank.bank.accountName ? 'Bank details changed by the team' : 'Bank details removed');
    r = { ok: bank.bank.accountName ? 'Bank details saved.' : 'Bank details removed.' };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id), r);
}

export async function approveAffiliateAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const a = await db.affiliate.findUniqueOrThrow({ where: { id } });
    if (a.status === 'active') throw new UserError(`${a.name} is already active.`);
    const code = normaliseCode(str(fd, 'code', 40));
    const problem = await codeProblem(code, id);
    if (problem) throw new UserError(problem);
    const discount = percent(fd, 'discountPct', 'Customer discount');
    if (!Number.isInteger(discount)) throw new UserError('Customer discount must be a whole number.');
    await db.affiliate.update({
      where: { id },
      data: { status: 'active', code, commissionBps: toBps(percent(fd, 'commissionPct', 'Commission')), customerDiscountPct: discount, approvedAt: a.approvedAt ?? new Date() },
    });
    await logActivity(admin.id, 'affiliate.approve', 'affiliate', id, `${a.name} (${code})`);
    r = { ok: `${a.name} approved with code ${code}. ${await sendInvite(id)}` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id), r);
}

export async function rejectAffiliateAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const a = await db.affiliate.update({ where: { id }, data: { status: 'rejected' } });
    await endAllAffiliateSessions(id);
    if (bool(fd, 'notify')) await sendAffiliateEmail(a, T.affiliateRejected(await getSettings(), a.name), 'affiliate_rejected');
    await logActivity(admin.id, 'affiliate.reject', 'affiliate', id, a.name);
    r = { ok: `${a.name} marked as rejected${bool(fd, 'notify') ? ' and told by email' : ''}.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id), r);
}

export async function setAffiliateStatusAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  const to = str(fd, 'status');
  let r: R;
  try {
    if (to !== 'active' && to !== 'paused') throw new UserError('Unknown status.');
    const a = await db.affiliate.update({ where: { id }, data: { status: to, ...(to === 'active' ? { approvedAt: new Date() } : {}) } });
    await logActivity(admin.id, `affiliate.${to === 'active' ? 'reactivate' : 'pause'}`, 'affiliate', id, a.name);
    r = {
      ok:
        to === 'paused'
          ? `${a.name} paused. Their code no longer works at checkout; they can still sign in to see their sales and payouts.`
          : `${a.name} is active again.${a.passwordHash ? '' : ' ' + (await sendInvite(id))}`,
    };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id), r);
}

export async function sendAffiliateInviteAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const a = await db.affiliate.findUniqueOrThrow({ where: { id } });
    if (a.status !== 'active' && a.status !== 'paused') throw new UserError('Approve the affiliate first.');
    r = { ok: await sendInvite(id) };
    await logActivity(admin.id, 'affiliate.invite', 'affiliate', id, a.email);
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id), r);
}

export async function deleteAffiliateAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  let gone = false;
  try {
    const a = await db.affiliate.findUniqueOrThrow({ where: { id }, include: { _count: { select: { commissions: true, payouts: true } } } });
    if (a._count.commissions || a._count.payouts) throw new UserError('This affiliate has commission or payouts on record, so they are kept for your accounts. Pause them instead.');
    await db.affiliate.delete({ where: { id } });
    await logActivity(admin.id, 'affiliate.delete', 'affiliate', id, `${a.name} <${a.email}>`);
    gone = true;
    r = { ok: `${a.name} deleted.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(gone ? '/admin/affiliates' : page(id), r);
}

// ───────────── Commission and payouts ─────────────

async function commissionFor(fd: FormData) {
  const c = await db.affiliateCommission.findUnique({ where: { id: str(fd, 'commissionId') } });
  if (!c || c.affiliateId !== str(fd, 'id')) throw new UserError('That commission no longer exists.');
  return c;
}

export async function approveCommissionAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const c = await commissionFor(fd);
    if (c.status !== 'pending') throw new UserError('Only pending commission can be approved.');
    await db.affiliateCommission.update({ where: { id: c.id }, data: { status: 'approved', approvedAt: new Date() } });
    await logActivity(admin.id, 'affiliate.commission_approve', 'affiliate', id, `${m2(c.amount)} approved early`);
    r = { ok: `${m2(c.amount)} is ready to pay.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id, '#commission'), r);
}

export async function voidCommissionAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const c = await commissionFor(fd);
    if (c.status !== 'pending' && c.status !== 'approved') throw new UserError('Only unpaid commission can be voided.');
    const reason = str(fd, 'reason', 200) || 'Voided by the team';
    // adminId marks a decision by the team, so order updates do not bring it back.
    await db.affiliateCommission.update({ where: { id: c.id }, data: { status: 'void', voidReason: reason, adminId: admin.id } });
    await logActivity(admin.id, 'affiliate.commission_void', 'affiliate', id, `${m2(c.amount)}: ${reason}`);
    r = { ok: `${m2(c.amount)} voided.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id, '#commission'), r);
}

export async function restoreCommissionAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const c = await commissionFor(fd);
    if (c.status !== 'void') throw new UserError('Only void commission can be restored.');
    if (c.kind === 'sale' && c.orderId) {
      await db.affiliateCommission.update({ where: { id: c.id }, data: { adminId: null } });
      await syncCommission(c.orderId, { notify: false });
    } else {
      await db.affiliateCommission.update({ where: { id: c.id }, data: { status: 'approved', approvedAt: new Date(), voidReason: null, adminId: admin.id } });
    }
    const now = await db.affiliateCommission.findUniqueOrThrow({ where: { id: c.id } });
    if (now.status !== 'void') await logActivity(admin.id, 'affiliate.commission_restore', 'affiliate', id, m2(now.amount));
    r = now.status === 'void' ? { err: `This stays void: ${now.voidReason?.toLowerCase() ?? 'the order no longer earns commission'}.` } : { ok: `${m2(now.amount)} restored.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id, '#commission'), r);
}

export async function addAdjustmentAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const raw = str(fd, 'amount', 20);
    const negative = raw.trim().startsWith('-');
    const amount = pounds(fd, 'amount', { label: 'Amount' });
    const signed = negative ? -Math.abs(amount) : Math.abs(amount);
    if (!signed) throw new UserError('Enter an amount, like 25 for a bonus or -10 for a deduction.');
    const description = str(fd, 'description', 200);
    if (!description) throw new UserError('Add a short reason. The affiliate sees it in their portal.');
    await db.affiliateCommission.create({
      data: { affiliateId: id, kind: 'adjustment', amount: signed, status: 'approved', approvedAt: new Date(), description, adminId: admin.id },
    });
    await logActivity(admin.id, 'affiliate.adjustment', 'affiliate', id, `${m2(signed)}: ${description}`);
    r = { ok: `${signed > 0 ? 'Bonus' : 'Deduction'} of ${m2(Math.abs(signed))} added; it is included in the next payout.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id, '#commission'), r);
}

export async function createPayoutAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const paidOn = dateOnly(fd, 'paidAt');
    const p = await createPayout(id, {
      adminId: admin.id,
      reference: optStr(fd, 'reference', 60),
      note: optStr(fd, 'note', 500),
      paidAt: paidOn && paidOn.toDateString() !== new Date().toDateString() ? paidOn : new Date(),
      notify: bool(fd, 'notify'),
    });
    await logActivity(admin.id, 'affiliate.payout', 'affiliate', id, `${m2(p.amount)}${p.reference ? `, ref ${p.reference}` : ''}`);
    r = { ok: `Payout of ${m2(p.amount)} recorded${bool(fd, 'notify') ? ' and the affiliate emailed' : ''}.` };
  } catch (e) {
    r = { err: e instanceof AffiliateError ? e.message : errorMessage(e) };
  }
  back(page(id, '#payouts'), r);
}

export async function undoPayoutAction(fd: FormData) {
  const admin = await requireArea('affiliateEdit');
  const id = str(fd, 'id');
  let r: R;
  try {
    const p = await undoPayout(str(fd, 'payoutId'));
    await logActivity(admin.id, 'affiliate.payout_undo', 'affiliate', id, m2(p.amount));
    r = { ok: `Payout of ${m2(p.amount)} removed. Its commission is ready to pay again.` };
  } catch (e) {
    r = { err: errorMessage(e) };
  }
  back(page(id, '#payouts'), r);
}
