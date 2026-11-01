import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { encryptionOn } from '@/lib/crypto';
import { logActivity } from '@/lib/activity';
import { can, requireArea } from '@/lib/admin/perms';
import { sp1, type SP } from '@/lib/admin/queries';
import { AFFILIATE_TONE, COMMISSION_TONE, ago, fd, fdt } from '@/lib/admin/format';
import { toDateInput } from '@/lib/admin/forms';
import { m2 } from '@/lib/money';
import { AFFILIATE_STATUS_LABEL, COMMISSION_LABEL, approveDueCommissions, balanceOf, clearsOn, maskTail, pct, readBank } from '@/lib/affiliates';
import { Flash, Notice, PageHead, Pill } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import { AffiliateForm } from '@/components/admin/affiliate-form';
import {
  addAdjustmentAction,
  approveAffiliateAction,
  approveCommissionAction,
  createPayoutAction,
  deleteAffiliateAction,
  rejectAffiliateAction,
  restoreCommissionAction,
  sendAffiliateInviteAction,
  setAffiliateStatusAction,
  undoPayoutAction,
  updateAffiliateAction,
  updateAffiliateBankAction,
  voidCommissionAction,
} from '../actions';

export const metadata = { title: 'Affiliate' };

const Id = ({ id }: { id: string }) => <input type="hidden" name="id" value={id} />;

export default async function AffiliatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const admin = await requireArea('affiliates');
  const [{ id }, sp, s] = await Promise.all([params, searchParams, getSettings()]);
  await approveDueCommissions();
  const a = await db.affiliate.findUnique({
    where: { id },
    include: {
      commissions: { orderBy: { createdAt: 'desc' }, take: 150, include: { order: { select: { id: true, number: true, status: true, dispatchedAt: true } } } },
      payouts: { orderBy: { paidAt: 'desc' }, take: 50, include: { admin: { select: { name: true } }, _count: { select: { commissions: true } } } },
      _count: { select: { commissions: true, payouts: true } },
    },
  });
  if (!a) notFound();
  const edit = can(admin, 'affiliateEdit');
  const showBank = edit && sp1(sp, 'bank') === 'show';
  if (showBank) await logActivity(admin.id, 'affiliate.bank_view', 'affiliate', a.id, a.name);

  const [bal, clicks30, unpaidOrders] = await Promise.all([
    balanceOf(a.id),
    db.affiliateClick.count({ where: { affiliateId: a.id, createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } }),
    db.order.count({ where: { affiliateId: a.id, status: 'awaiting_payment' } }),
  ]);
  const bank = readBank(a);
  const ready = a.commissions.filter((c) => c.status === 'approved' && !c.payoutId);
  const recentBankChange = a.bankUpdatedAt && Date.now() - a.bankUpdatedAt.getTime() < 14 * 864e5;
  const link = `${siteUrl()}/r/${a.code}`;
  const ref = `${a.code} ${new Date().toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'Europe/London' }).replace(' ', '').toUpperCase()}`.slice(0, 18);

  return (
    <>
      <PageHead
        crumbs={[['Affiliates', '/admin/affiliates'], [a.name]]}
        title={a.name}
        after={<Pill tone={AFFILIATE_TONE[a.status] ?? ''}>{AFFILIATE_STATUS_LABEL[a.status] ?? a.status}</Pill>}
        sub={
          <>
            <a className="a-link muted" href={`mailto:${a.email}`}>
              {a.email}
            </a>
            {a.phone ? ` · ${a.phone}` : ''}
            {a.company ? ` · ${a.company}` : ''} · {a.status === 'pending' ? 'applied' : 'joined'} {fd(a.approvedAt ?? a.createdAt)}
            {a.lastLoginAt ? ` · last signed in ${ago(a.lastLoginAt)}` : ''}
          </>
        }
      />
      <Flash sp={sp} />

      {(a.status === 'pending' || a.status === 'rejected') && (
        <div className="a-card" style={{ marginBottom: 16 }}>
          <h2 className="a-h2">{a.status === 'pending' ? 'Application' : 'Rejected application'}</h2>
          <dl className="a-dl">
            <dt>Applied</dt>
            <dd>{fdt(a.createdAt)}</dd>
            <dt>Website or profile</dt>
            <dd>
              {a.website ? (
                /^https?:\/\//i.test(a.website) ? (
                  <a className="a-link" href={a.website} target="_blank" rel="noopener noreferrer nofollow">
                    {a.website}
                  </a>
                ) : (
                  a.website
                )
              ) : (
                '·'
              )}
            </dd>
            <dt>Other channels</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{a.socials || '·'}</dd>
            <dt>Agreed to the rules</dt>
            <dd>{a.termsAcceptedAt ? fdt(a.termsAcceptedAt) : 'No'}</dd>
          </dl>
          {a.pitch && (
            <div className="a-msg" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
              {a.pitch}
            </div>
          )}
          {edit && (
            <>
              <hr className="a-sep" />
              <form action={approveAffiliateAction} className="a-inline" style={{ alignItems: 'flex-end' }}>
                <Id id={a.id} />
                <div className="a-field mono" style={{ maxWidth: 170 }}>
                  <label htmlFor="apCode">Code</label>
                  <input id="apCode" name="code" defaultValue={a.code} required maxLength={20} style={{ textTransform: 'uppercase' }} />
                </div>
                <div className="a-field mono" style={{ maxWidth: 130 }}>
                  <label htmlFor="apRate">Commission (%)</label>
                  <input id="apRate" name="commissionPct" inputMode="decimal" defaultValue={a.commissionBps / 100} required />
                </div>
                <div className="a-field mono" style={{ maxWidth: 200 }}>
                  <label htmlFor="apDisc">Customer discount (%)</label>
                  <input id="apDisc" name="discountPct" type="number" min={0} max={50} defaultValue={a.customerDiscountPct} required />
                </div>
                <SubmitButton className="a-btn copper" pending="Approving…">
                  Approve and send welcome email
                </SubmitButton>
              </form>
              {a.status === 'pending' && (
                <form action={rejectAffiliateAction} className="a-inline" style={{ marginTop: 12 }}>
                  <Id id={a.id} />
                  <label className="a-check" style={{ margin: 0 }}>
                    <input type="checkbox" name="notify" defaultChecked />
                    <span>Email them a polite no</span>
                  </label>
                  <SubmitButton className="a-btn ghost" confirm={`Reject ${a.name}'s application?`}>
                    Reject
                  </SubmitButton>
                </form>
              )}
            </>
          )}
        </div>
      )}

      <div className="a-kpis">
        <div className="a-kpi">
          <span>Orders credited</span>
          <b>{bal.sales}</b>
          <small>
            {clicks30} {clicks30 === 1 ? 'link visit' : 'link visits'} in 30 days{unpaidOrders ? ` · ${unpaidOrders} awaiting payment` : ''}
          </small>
        </div>
        <div className="a-kpi">
          <span>Sales</span>
          <b>{m2(bal.salesValue)}</b>
          <small>After discounts and refunds, excluding delivery</small>
        </div>
        <div className="a-kpi">
          <span>{bal.approved < 0 ? 'Owed back' : 'Ready to pay'}</span>
          <b>{m2(Math.abs(bal.approved))}</b>
          <small>{bal.pending ? `${m2(bal.pending)} pending` : 'Nothing pending'}</small>
        </div>
        <div className="a-kpi">
          <span>Paid to date</span>
          <b>{m2(bal.paid)}</b>
          <small>
            {a.payouts.length} {a.payouts.length === 1 ? 'payout' : 'payouts'}
            {a.payouts[0] ? `, last ${fd(a.payouts[0].paidAt)}` : ''}
          </small>
        </div>
      </div>

      <div className="a-split">
        <div className="a-stack">
          <div className="a-card flush" id="commission">
            <h2 className="a-h2">Commission</h2>
            {a.commissions.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="a-table" style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>For</th>
                      <th>Status</th>
                      <th className="num">Amount</th>
                      {edit && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {a.commissions.map((c) => {
                      const clears = c.status === 'pending' ? clearsOn(c.order?.dispatchedAt, s) : null;
                      return (
                        <tr key={c.id}>
                          <td className="a-small" style={{ color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                            {fd(c.createdAt)}
                          </td>
                          <td>
                            {c.kind === 'adjustment' ? (
                              <>
                                {c.amount < 0 ? 'Deduction' : 'Bonus'}
                                <span className="a-small">{c.description}</span>
                              </>
                            ) : (
                              <>
                                {c.kind === 'clawback' ? 'Clawback · ' : ''}
                                {c.order ? (
                                  <Link className="a-rowlink a-mono" href={`/admin/orders/${c.order.id}`}>
                                    {c.order.number}
                                  </Link>
                                ) : (
                                  'Deleted order'
                                )}
                                <span className="a-small">{c.kind === 'clawback' ? c.description : `${m2(c.basis)} at ${pct(c.rateBps)}`}</span>
                              </>
                            )}
                          </td>
                          <td>
                            <Pill tone={COMMISSION_TONE[c.status] ?? ''}>{COMMISSION_LABEL[c.status] ?? c.status}</Pill>
                            <span className="a-small">
                              {c.status === 'pending'
                                ? clears
                                  ? `Clears ${fd(clears)}`
                                  : 'Waiting for dispatch'
                                : c.status === 'void'
                                  ? c.voidReason
                                  : c.status === 'paid' && c.paidAt
                                    ? `Paid ${fd(c.paidAt)}`
                                    : c.approvedAt
                                      ? `Since ${fd(c.approvedAt)}`
                                      : ''}
                            </span>
                          </td>
                          <td className="num" style={{ color: c.amount < 0 ? 'var(--a-bad)' : undefined, textDecoration: c.status === 'void' ? 'line-through' : undefined }}>
                            {m2(c.amount)}
                          </td>
                          {edit && (
                            <td>
                              {c.status === 'pending' && (
                                <form action={approveCommissionAction} style={{ display: 'inline' }}>
                                  <Id id={a.id} />
                                  <input type="hidden" name="commissionId" value={c.id} />
                                  <SubmitButton className="a-link" confirm="Approve this before the hold period ends? Refunds after payout are deducted from later payouts.">
                                    Approve now
                                  </SubmitButton>
                                </form>
                              )}
                              {(c.status === 'pending' || c.status === 'approved') && (
                                <details className="a-details" style={{ marginTop: c.status === 'pending' ? 6 : 0 }}>
                                  <summary>Void</summary>
                                  <form action={voidCommissionAction} className="a-inline">
                                    <Id id={a.id} />
                                    <input type="hidden" name="commissionId" value={c.id} />
                                    <div className="a-field">
                                      <label htmlFor={`vr-${c.id}`} className="a-sr">
                                        Reason
                                      </label>
                                      <input id={`vr-${c.id}`} name="reason" placeholder="Reason, e.g. own order" maxLength={200} />
                                    </div>
                                    <SubmitButton className="a-btn ghost sm">Void</SubmitButton>
                                  </form>
                                </details>
                              )}
                              {c.status === 'void' && (
                                <form action={restoreCommissionAction} style={{ display: 'inline' }}>
                                  <Id id={a.id} />
                                  <input type="hidden" name="commissionId" value={c.id} />
                                  <SubmitButton className="a-link">Restore</SubmitButton>
                                </form>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="a-muted" style={{ padding: '6px 20px 0', margin: 0 }}>
                No commission yet. It appears here when an order placed with {a.code} is paid.
              </p>
            )}
            {edit && (
              <div style={{ padding: '14px 20px 20px' }}>
                <details className="a-details">
                  <summary>Add a bonus or deduction</summary>
                  <form action={addAdjustmentAction} className="a-inline">
                    <Id id={a.id} />
                    <div className="a-field mono" style={{ maxWidth: 140 }}>
                      <label htmlFor="adjAmt">Amount (£)</label>
                      <input id="adjAmt" name="amount" inputMode="decimal" placeholder="25 or -10" required />
                    </div>
                    <div className="a-field">
                      <label htmlFor="adjWhy">Reason (they see this)</label>
                      <input id="adjWhy" name="description" placeholder="e.g. Launch bonus" maxLength={200} required />
                    </div>
                    <SubmitButton className="a-btn ghost">Add</SubmitButton>
                  </form>
                </details>
              </div>
            )}
          </div>

          <div className="a-card" id="payouts">
            <h2 className="a-h2">Payouts</h2>
            {edit && bal.approved > 0 && (
              <>
                {!bank.complete && <Notice tone="err">No bank details yet. Ask {a.name.split(' ')[0]} to add them under Your details in the affiliate portal, or add them here.</Notice>}
                {bank.complete && recentBankChange && (
                  <Notice tone="err">Bank details changed {ago(a.bankUpdatedAt!)}. Check the change with {a.name.split(' ')[0]} through a channel you trust before paying.</Notice>
                )}
                <p style={{ margin: '0 0 12px' }}>
                  <b>{m2(bal.approved)}</b> ready to pay across {ready.length} {ready.length === 1 ? 'item' : 'items'}
                  {bal.approved < s.affiliates.minPayout ? ` (below your ${m2(s.affiliates.minPayout)} minimum; you can still pay it)` : ''}.
                  {bank.complete && (
                    <>
                      {' '}
                      Pay to {bank.accountName}, {bank.sortCode ? `${showBank ? bank.sortCode : '••-••-' + bank.sortCode.slice(-2)} · ${showBank ? bank.accountNumber : maskTail(bank.accountNumber)}` : showBank ? bank.iban : maskTail(bank.iban)}
                      {!showBank && (
                        <>
                          {' '}
                          <Link className="a-link" href={`/admin/affiliates/${a.id}?bank=show#payouts`}>
                            Show in full
                          </Link>
                        </>
                      )}
                    </>
                  )}
                </p>
                <form action={createPayoutAction} className="a-form">
                  <Id id={a.id} />
                  <div className="a-row3">
                    <div className="a-field mono">
                      <label htmlFor="poRef">Payment reference</label>
                      <input id="poRef" name="reference" defaultValue={ref} maxLength={60} />
                    </div>
                    <div className="a-field">
                      <label htmlFor="poDate">Paid on</label>
                      <input id="poDate" name="paidAt" type="date" defaultValue={toDateInput(new Date())} />
                    </div>
                    <div className="a-field">
                      <label htmlFor="poNote">Note (team only)</label>
                      <input id="poNote" name="note" maxLength={500} />
                    </div>
                  </div>
                  <label className="a-check">
                    <input type="checkbox" name="notify" defaultChecked />
                    <span>Email {a.name.split(' ')[0]} that it is on its way</span>
                  </label>
                  <div className="a-formfoot">
                    <SubmitButton className="a-btn copper" confirm={`Record a payout of ${m2(bal.approved)} to ${a.name}? Send the bank transfer first.`}>
                      Record payout of {m2(bal.approved)}
                    </SubmitButton>
                  </div>
                </form>
                <p className="a-small" style={{ margin: '10px 0 0' }}>
                  Send the money from your bank first, then record it here. This marks the items as paid and shows the payout in their portal.
                </p>
              </>
            )}
            {!(edit && bal.approved > 0) && (
              <p className="a-muted" style={{ margin: '0 0 6px' }}>
                {bal.approved > 0 ? `${m2(bal.approved)} is ready to pay.` : 'Nothing is ready to pay yet.'}
                {bal.pending ? ` ${m2(bal.pending)} is pending until its hold period ends.` : ''}
              </p>
            )}
            {a.payouts.length > 0 && (
              <table className="a-table compact" style={{ marginTop: 14 }}>
                <thead>
                  <tr>
                    <th>Paid</th>
                    <th>Reference</th>
                    <th className="num">Amount</th>
                    {edit && (
                      <th>
                        <span className="a-sr">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {a.payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="a-small" style={{ color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                        {fd(p.paidAt)}
                      </td>
                      <td>
                        <span className="a-mono">{p.reference || '·'}</span>
                        <span className="a-small">
                          {p._count.commissions} {p._count.commissions === 1 ? 'item' : 'items'}
                          {p.admin ? ` · by ${p.admin.name}` : ''}
                          {p.note ? ` · ${p.note}` : ''}
                        </span>
                      </td>
                      <td className="num">{m2(p.amount)}</td>
                      {edit && (
                        <td>
                          <form action={undoPayoutAction}>
                            <Id id={a.id} />
                            <input type="hidden" name="payoutId" value={p.id} />
                            <SubmitButton className="a-link muted" confirm="Remove this payout record? Its items go back to ready to pay. Money already sent is not affected.">
                              Undo
                            </SubmitButton>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">Code and link</h2>
            <dl className="a-dl">
              <dt>Code</dt>
              <dd>
                <span className="a-code">{a.code}</span>
              </dd>
              <dt>Link</dt>
              <dd className="a-mono" style={{ wordBreak: 'break-all', fontSize: 13 }}>
                {link}
              </dd>
              <dt>Customers get</dt>
              <dd>{a.customerDiscountPct ? `${a.customerDiscountPct}% off` : 'No discount (tracking only)'}</dd>
              <dt>They earn</dt>
              <dd>{pct(a.commissionBps)} of the order value after discounts</dd>
            </dl>
            {a.status === 'paused' && (
              <p className="a-small" style={{ margin: '10px 0 0' }}>
                Paused: the code does not work at checkout until you reactivate them.
              </p>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">Details</h2>
            {edit ? (
              <AffiliateForm action={updateAffiliateAction} a={a} code={a.code} commissionPct={a.commissionBps / 100} discountPct={a.customerDiscountPct} />
            ) : (
              <dl className="a-dl">
                <dt>Website</dt>
                <dd>{a.website || '·'}</dd>
                <dt>Other channels</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{a.socials || '·'}</dd>
                <dt>Address</dt>
                <dd>{[a.addressLine1, a.addressLine2, a.city, a.postcode, a.country].filter(Boolean).join(', ') || '·'}</dd>
                <dt>Notes</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{a.notes || '·'}</dd>
              </dl>
            )}
          </div>

          <div className="a-card" id="bank">
            <h2 className="a-h2">Bank details</h2>
            {!edit ? (
              <p className="a-muted" style={{ margin: 0 }}>
                Only admins and owners can see bank details.
              </p>
            ) : bank.unreadable ? (
              <Notice tone="err">
                These were saved with a different ENCRYPTION_KEY and cannot be read on this server. Restore the original key, or ask the affiliate to enter them again.
              </Notice>
            ) : showBank ? (
              <form action={updateAffiliateBankAction} className="a-form">
                <Id id={a.id} />
                <div className="a-field">
                  <label htmlFor="bkName">Name on the account</label>
                  <input id="bkName" name="bankAccountName" defaultValue={bank.accountName} maxLength={120} autoComplete="off" />
                </div>
                <div className="a-row2">
                  <div className="a-field mono">
                    <label htmlFor="bkSort">Sort code</label>
                    <input id="bkSort" name="bankSortCode" defaultValue={bank.sortCode} maxLength={8} inputMode="numeric" autoComplete="off" />
                  </div>
                  <div className="a-field mono">
                    <label htmlFor="bkAcc">Account number</label>
                    <input id="bkAcc" name="bankAccountNumber" defaultValue={bank.accountNumber} maxLength={10} inputMode="numeric" autoComplete="off" />
                  </div>
                  <div className="a-field mono">
                    <label htmlFor="bkIban">IBAN</label>
                    <input id="bkIban" name="bankIban" defaultValue={bank.iban} maxLength={40} autoComplete="off" />
                  </div>
                  <div className="a-field mono">
                    <label htmlFor="bkBic">BIC (SWIFT)</label>
                    <input id="bkBic" name="bankBic" defaultValue={bank.bic} maxLength={11} autoComplete="off" />
                  </div>
                </div>
                <div className="a-formfoot" style={{ justifyContent: 'space-between' }}>
                  <Link className="a-link muted" href={`/admin/affiliates/${a.id}`}>
                    Hide
                  </Link>
                  <SubmitButton className="a-btn">Save bank details</SubmitButton>
                </div>
              </form>
            ) : (
              <>
                {bank.complete ? (
                  <dl className="a-dl">
                    <dt>Account name</dt>
                    <dd>{bank.accountName}</dd>
                    {bank.sortCode && (
                      <>
                        <dt>Sort code</dt>
                        <dd className="a-mono">••-••-{bank.sortCode.slice(-2)}</dd>
                        <dt>Account</dt>
                        <dd className="a-mono">{maskTail(bank.accountNumber)}</dd>
                      </>
                    )}
                    {bank.iban && (
                      <>
                        <dt>IBAN</dt>
                        <dd className="a-mono">{maskTail(bank.iban)}</dd>
                      </>
                    )}
                    <dt>Last changed</dt>
                    <dd>{a.bankUpdatedAt ? fdt(a.bankUpdatedAt) : '·'}</dd>
                  </dl>
                ) : (
                  <p className="a-muted" style={{ margin: 0 }}>
                    None yet. {a.name.split(' ')[0]} can add them in the affiliate portal.
                  </p>
                )}
                <p style={{ margin: '12px 0 0' }}>
                  <Link className="a-link" href={`/admin/affiliates/${a.id}?bank=show#bank`}>
                    {bank.complete ? 'Show in full or edit' : 'Add bank details'}
                  </Link>
                </p>
                <p className="a-small" style={{ margin: '8px 0 0' }}>
                  {encryptionOn() ? 'Stored encrypted.' : 'Set ENCRYPTION_KEY on the server to store bank details encrypted.'} Viewing them is recorded in the activity log.
                </p>
              </>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">Portal access</h2>
            <dl className="a-dl">
              <dt>Password</dt>
              <dd>{a.passwordHash ? 'Set' : 'Not set yet'}</dd>
              <dt>Last signed in</dt>
              <dd>{a.lastLoginAt ? fdt(a.lastLoginAt) : 'Never'}</dd>
              <dt>Sale emails</dt>
              <dd>{a.notifySales ? 'On' : 'Off'}</dd>
            </dl>
            {edit && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {(a.status === 'active' || a.status === 'paused') && (
                  <form action={sendAffiliateInviteAction}>
                    <Id id={a.id} />
                    <SubmitButton className="a-btn ghost sm">{a.passwordHash ? 'Send password reset link' : 'Resend welcome email'}</SubmitButton>
                  </form>
                )}
                {a.status === 'active' && (
                  <form action={setAffiliateStatusAction}>
                    <Id id={a.id} />
                    <input type="hidden" name="status" value="paused" />
                    <SubmitButton className="a-btn ghost sm" confirm={`Pause ${a.name}? Their code stops working at checkout. They can still sign in.`}>
                      Pause
                    </SubmitButton>
                  </form>
                )}
                {a.status === 'paused' && (
                  <form action={setAffiliateStatusAction}>
                    <Id id={a.id} />
                    <input type="hidden" name="status" value="active" />
                    <SubmitButton className="a-btn ghost sm">Reactivate</SubmitButton>
                  </form>
                )}
              </div>
            )}
          </div>

          {edit && a._count.commissions === 0 && a._count.payouts === 0 && (
            <div className="a-card a-danger-zone">
              <h2 className="a-h2">Delete</h2>
              <p className="a-small" style={{ margin: '0 0 12px' }}>
                Removes {a.name} completely. Only possible while they have no commission or payouts on record.
              </p>
              <form action={deleteAffiliateAction}>
                <Id id={a.id} />
                <SubmitButton className="a-btn ghost sm" confirm={`Delete ${a.name} for good?`}>
                  Delete affiliate
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
