import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { can, requireArea } from '@/lib/admin/perms';
import { customerTotals, type SP } from '@/lib/admin/queries';
import { fd, fdt } from '@/lib/admin/format';
import { m2 } from '@/lib/money';
import { Flash, OrderPill, PageHead, Pill, TicketPill } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import {
  addCustomerNoteAction,
  adjustCreditAction,
  anonymiseCustomerAction,
  blockCustomerAction,
  deleteCustomerNoteAction,
  sendResetAction,
  updateCustomerAction,
} from '../actions';

export const metadata = { title: 'Customer' };

const Id = ({ id }: { id: string }) => <input type="hidden" name="id" value={id} />;

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const admin = await requireArea('customers');
  const { id } = await params;
  const sp = await searchParams;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: { isDefault: 'desc' } },
      orders: { orderBy: { createdAt: 'desc' }, take: 50, include: { items: { select: { qty: true, productCode: true, packQty: true } } } },
      notes: { orderBy: { createdAt: 'desc' }, include: { admin: { select: { name: true } } } },
      tickets: { orderBy: { lastMessageAt: 'desc' }, take: 20 },
      alerts: { include: { product: { select: { name: true } } } },
      credits: { orderBy: { createdAt: 'desc' }, take: 30, include: { admin: { select: { name: true } } } },
      referredBy: { select: { id: true, name: true, email: true } },
      referrals: { select: { id: true, name: true, email: true, createdAt: true } },
    },
  });
  if (!c) notFound();
  const [totals, subscriber, sessions] = await Promise.all([
    customerTotals([c.id]),
    db.subscriber.findUnique({ where: { email: c.email } }),
    db.session.count({ where: { customerId: c.id, expiresAt: { gt: new Date() } } }),
  ]);
  const t = totals.get(c.id) ?? { orders: 0, spent: 0, last: null };
  const edit = can(admin, 'customerEdit');
  const anonymised = c.tags.includes('anonymised');

  return (
    <>
      <PageHead
        crumbs={[['Customers', '/admin/customers'], [c.name || c.email]]}
        title={c.name || c.email}
        after={
          <>
            {c.blocked ? <Pill tone="red">Blocked</Pill> : <Pill tone={c.passwordHash ? 'green' : ''}>{c.passwordHash ? 'Has an account' : 'Guest'}</Pill>}
            {c.marketingOptIn && <Pill tone="blue">Marketing emails</Pill>}
          </>
        }
        sub={
          <>
            <a className="a-link muted" href={`mailto:${c.email}`}>
              {c.email}
            </a>
            {c.phone ? ` · ${c.phone}` : ''} · joined {fd(c.createdAt)}
            {c.lastLoginAt ? ` · last signed in ${fd(c.lastLoginAt)}` : ''}
          </>
        }
        actions={
          edit ? (
            <a className="a-btn ghost" href={`/api/admin/customers/${c.id}/export`}>
              Download their data
            </a>
          ) : undefined
        }
      />
      <Flash sp={sp} />

      <div className="a-kpis">
        <div className="a-kpi">
          <span>Orders</span>
          <b>{t.orders}</b>
          <small>{t.last ? `Last ${fd(t.last)}` : 'No orders yet'}</small>
        </div>
        <div className="a-kpi">
          <span>Spent</span>
          <b>{m2(t.spent)}</b>
          <small>Paid, net of refunds</small>
        </div>
        <div className="a-kpi">
          <span>Average order</span>
          <b>{t.orders ? m2(Math.round(t.spent / Math.max(1, c.orders.filter((o) => o.paymentStatus !== 'unpaid').length))) : '·'}</b>
          <small>Paid orders</small>
        </div>
        <div className="a-kpi">
          <span>Store credit</span>
          <b>{m2(c.creditPence)}</b>
          <small>{c.referrals.length ? `${c.referrals.length} referred` : 'No referrals yet'}</small>
        </div>
      </div>

      <div className="a-split">
        <div className="a-stack">
          <div className="a-card flush">
            <h2 className="a-h2">Orders</h2>
            {c.orders.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="a-table" style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Items</th>
                      <th>Status</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link className="a-rowlink a-mono" href={`/admin/orders/${o.id}`}>
                            {o.number}
                          </Link>
                          <span className="a-small">{fdt(o.createdAt)}</span>
                        </td>
                        <td className="a-small" style={{ color: 'var(--ink)' }}>
                          {o.items.map((i) => `${i.qty} × ${i.productCode}${i.packQty > 1 ? ` (${i.packQty})` : ''}`).join(', ')}
                        </td>
                        <td>
                          <OrderPill status={o.status} />
                        </td>
                        <td className="num">{m2(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="a-muted" style={{ padding: '6px 20px 20px', margin: 0 }}>
                No orders.
              </p>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">Team notes</h2>
            <form action={addCustomerNoteAction} className="a-form" style={{ marginBottom: 16 }}>
              <Id id={c.id} />
              <div className="a-field">
                <label htmlFor="cn" className="a-sr">
                  Note
                </label>
                <textarea id="cn" name="body" placeholder="Add a note for the team, for example a trade agreement or a delivery preference. Customers never see these." style={{ minHeight: 64 }} maxLength={2000} />
              </div>
              <div className="a-formfoot">
                <SubmitButton className="a-btn ghost sm">Add note</SubmitButton>
              </div>
            </form>
            {c.notes.length ? (
              <ol className="a-tl">
                {c.notes.map((n) => (
                  <li key={n.id} className="note">
                    <div className="msg" style={{ whiteSpace: 'pre-wrap' }}>
                      {n.body}
                    </div>
                    <div className="meta" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {n.admin?.name ?? 'Former team member'} · {fdt(n.createdAt)}
                      {(n.adminId === admin.id || admin.role !== 'staff') && (
                        <form action={deleteCustomerNoteAction} style={{ display: 'inline' }}>
                          <Id id={c.id} />
                          <input type="hidden" name="noteId" value={n.id} />
                          <SubmitButton className="a-link muted" confirm="Delete this note?">
                            Delete
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                No notes yet.
              </p>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">Conversations</h2>
            {c.tickets.length ? (
              c.tickets.map((tk) => (
                <Link key={tk.id} href={`/admin/inbox/${tk.id}`} className="a-kv" style={{ textDecoration: 'none' }}>
                  <span>
                    <span className="a-mono" style={{ fontSize: 13 }}>
                      {tk.ref}
                    </span>{' '}
                    {tk.topic}
                  </span>
                  <TicketPill status={tk.status} />
                </Link>
              ))
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                No conversations.
              </p>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">Store credit · {m2(c.creditPence)}</h2>
            {edit && (
              <form action={adjustCreditAction} className="a-inline" style={{ marginBottom: 14 }}>
                <Id id={c.id} />
                <div className="a-field mono" style={{ maxWidth: 140 }}>
                  <label htmlFor="camt">Amount (£)</label>
                  <input id="camt" name="amount" inputMode="decimal" placeholder="5 or -5" />
                </div>
                <div className="a-field">
                  <label htmlFor="creason">Reason</label>
                  <input id="creason" name="reason" placeholder="e.g. Goodwill for late delivery" maxLength={200} />
                </div>
                <SubmitButton className="a-btn ghost">Adjust</SubmitButton>
              </form>
            )}
            {c.credits.length ? (
              <table className="a-table compact">
                <tbody>
                  {c.credits.map((e) => (
                    <tr key={e.id}>
                      <td className="a-small" style={{ color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                        {fd(e.createdAt)}
                      </td>
                      <td>
                        {e.reason}
                        {e.admin && <span className="a-small">by {e.admin.name}</span>}
                      </td>
                      <td className="num" style={{ color: e.amount < 0 ? 'var(--a-bad)' : 'var(--a-good)' }}>
                        {e.amount > 0 ? '+' : ''}
                        {m2(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                No credit history.
              </p>
            )}
          </div>
        </div>

        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">Details</h2>
            {edit && !anonymised ? (
              <form action={updateCustomerAction} className="a-form">
                <Id id={c.id} />
                <div className="a-field">
                  <label htmlFor="cname">Name</label>
                  <input id="cname" name="name" defaultValue={c.name} maxLength={120} />
                </div>
                <div className="a-field">
                  <label htmlFor="cphone">Phone</label>
                  <input id="cphone" name="phone" defaultValue={c.phone ?? ''} maxLength={40} />
                </div>
                <div className="a-field">
                  <label htmlFor="ctags">Tags</label>
                  <input id="ctags" name="tags" defaultValue={c.tags} placeholder="trade, vip" maxLength={400} />
                  <span className="hint">Comma separated. Filter by tag on the customers list.</span>
                </div>
                <div className="a-formfoot">
                  <SubmitButton className="a-btn">Save</SubmitButton>
                </div>
              </form>
            ) : (
              <dl className="a-dl">
                <dt>Name</dt>
                <dd>{c.name || '·'}</dd>
                <dt>Phone</dt>
                <dd>{c.phone || '·'}</dd>
                <dt>Tags</dt>
                <dd>{c.tags || '·'}</dd>
              </dl>
            )}
            <hr className="a-sep" />
            <dl className="a-dl">
              <dt>Newsletter</dt>
              <dd>{subscriber ? (subscriber.unsubscribedAt ? `Unsubscribed ${fd(subscriber.unsubscribedAt)}` : `Subscribed ${fd(subscriber.createdAt)} (${subscriber.source})`) : 'Not subscribed'}</dd>
              <dt>Shipping emails</dt>
              <dd>{c.shippingUpdates ? 'On' : 'Turned off by the customer'}</dd>
              <dt>Signed in on</dt>
              <dd>{sessions ? `${sessions} ${sessions === 1 ? 'device' : 'devices'}` : 'No active sessions'}</dd>
              <dt>Email verified</dt>
              <dd>{c.emailVerifiedAt ? fd(c.emailVerifiedAt) : 'No'}</dd>
            </dl>
          </div>

          <div className="a-card">
            <h2 className="a-h2">Addresses</h2>
            {c.addresses.length ? (
              c.addresses.map((ad) => (
                <p key={ad.id} className="a-address" style={{ marginBottom: 12 }}>
                  {ad.isDefault && (
                    <>
                      <Pill plain>Default</Pill>
                      <br />
                    </>
                  )}
                  {ad.name}
                  <br />
                  {ad.line1}
                  {ad.line2 ? `, ${ad.line2}` : ''}
                  <br />
                  {ad.city} <span className="a-mono">{ad.postcode}</span>
                </p>
              ))
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                No saved addresses. Order addresses are on each order.
              </p>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">Restock alerts</h2>
            {c.alerts.length ? (
              c.alerts.map((al) => (
                <div key={al.id} className="a-kv">
                  <span>{al.product.name}</span>
                  <span className="a-small">since {fd(al.createdAt)}</span>
                </div>
              ))
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                None.
              </p>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">Referrals</h2>
            <dl className="a-dl">
              <dt>Their code</dt>
              <dd>
                <span className="a-code">{c.referralCode}</span>
              </dd>
              <dt>Referred by</dt>
              <dd>
                {c.referredBy ? (
                  <Link className="a-link" href={`/admin/customers/${c.referredBy.id}`}>
                    {c.referredBy.name || c.referredBy.email}
                  </Link>
                ) : (
                  '·'
                )}
              </dd>
            </dl>
            {c.referrals.length > 0 && (
              <>
                <hr className="a-sep" />
                {c.referrals.map((rf) => (
                  <div key={rf.id} className="a-kv">
                    <Link className="a-link muted" href={`/admin/customers/${rf.id}`}>
                      {rf.name || rf.email}
                    </Link>
                    <span className="a-small">{fd(rf.createdAt)}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {edit && !anonymised && (
            <div className="a-card a-danger-zone">
              <h2 className="a-h2">Account</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <form action={sendResetAction}>
                  <Id id={c.id} />
                  <SubmitButton className="a-btn ghost block" confirm={`Email a password reset link to ${c.email}?`}>
                    Email a password reset link
                  </SubmitButton>
                </form>
                <form action={blockCustomerAction}>
                  <Id id={c.id} />
                  <SubmitButton className="a-btn danger block" confirm={c.blocked ? 'Unblock this customer?' : 'Block this customer? They are signed out and cannot sign in.'}>
                    {c.blocked ? 'Unblock customer' : 'Block customer'}
                  </SubmitButton>
                </form>
              </div>
              <details className="a-details" style={{ marginTop: 16 }}>
                <summary>Erase personal data</summary>
                <p className="a-small" style={{ margin: '0 0 10px' }}>
                  For a deletion request under UK GDPR. Removes name, email, phone, addresses, notes, alerts and message text from this customer and their orders. Order totals are kept for
                  tax records. This cannot be undone. Download their data first if they asked for a copy.
                </p>
                <form action={anonymiseCustomerAction} className="a-inline">
                  <Id id={c.id} />
                  <div className="a-field">
                    <label htmlFor="conf">Type ANONYMISE to confirm</label>
                    <input id="conf" name="confirm" autoComplete="off" />
                  </div>
                  <SubmitButton className="a-btn danger" confirm="Erase this customer's personal data? This cannot be undone.">
                    Erase
                  </SubmitButton>
                </form>
              </details>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
