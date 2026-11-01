import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { fdt } from '@/lib/admin/format';
import { m2 } from '@/lib/money';
import { Flash, OrderPill, PageHead, TicketPill } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import { assignAction, replyAction, ticketStatusAction } from '../actions';

export const metadata = { title: 'Conversation' };

const Id = ({ id }: { id: string }) => <input type="hidden" name="id" value={id} />;

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const admin = await requireArea('inbox');
  const { id } = await params;
  const sp = await searchParams;
  const t = await db.ticket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' }, include: { admin: { select: { name: true } } } }, customer: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
  });
  if (!t) notFound();
  const [team, order, otherTickets] = await Promise.all([
    db.adminUser.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    t.orderNumber ? db.order.findUnique({ where: { number: t.orderNumber }, select: { id: true, number: true, status: true, total: true, email: true } }) : Promise.resolve(null),
    db.ticket.count({ where: { email: t.email, NOT: { id: t.id } } }),
  ]);
  const first = t.name.split(' ')[0] || 'there';

  return (
    <>
      <PageHead
        crumbs={[['Inbox', '/admin/inbox'], [t.ref]]}
        title={t.topic}
        after={<TicketPill status={t.status} />}
        sub={
          <>
            <span className="a-mono">{t.ref}</span> · {t.name} &lt;{t.email}&gt; · started {fdt(t.createdAt)}
            {t.channel === 'chat' ? ' · from the chat assistant' : ''}
          </>
        }
      />
      <Flash sp={sp} />
      <div className="a-split">
        <div className="a-stack">
          <div className="a-card">
            <div className="a-thread">
              {t.messages.map((m) => (
                <div key={m.id} className={`a-msg ${m.author}`}>
                  <span className="who">
                    {m.author === 'admin' ? m.admin?.name ?? 'Team' : m.author === 'customer' ? t.name : 'System'} · {fdt(m.createdAt)}
                  </span>
                  {m.body}
                </div>
              ))}
            </div>
          </div>
          <div className="a-card">
            <h2 className="a-h2">Reply</h2>
            <form action={replyAction} className="a-form">
              <Id id={t.id} />
              <div className="a-field">
                <label htmlFor="rb" className="a-sr">
                  Reply
                </label>
                <textarea id="rb" name="body" required defaultValue={`Hi ${first},\n\n\n\nBest wishes,\n${admin.name.split(' ')[0]}`} style={{ minHeight: 190 }} maxLength={8000} />
                <span className="hint">
                  Emailed to {t.email} with a link to this conversation, where they can reply. Never give dosing or usage advice: products are for laboratory research only.
                </span>
              </div>
              <div className="a-inline">
                <div className="a-field" style={{ maxWidth: 280 }}>
                  <label htmlFor="rs">After sending</label>
                  <select id="rs" name="status" defaultValue="pending">
                    <option value="pending">Wait for the customer</option>
                    <option value="closed">Close the conversation</option>
                    <option value="open">Keep it open</option>
                  </select>
                </div>
                <SubmitButton className="a-btn copper" pending="Sending…">
                  Send reply
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">Status</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['open', 'pending', 'closed'] as const)
                .filter((s) => s !== t.status)
                .map((s) => (
                  <form key={s} action={ticketStatusAction}>
                    <Id id={t.id} />
                    <input type="hidden" name="status" value={s} />
                    <SubmitButton className="a-btn ghost sm">{s === 'open' ? 'Reopen' : s === 'pending' ? 'Waiting on customer' : 'Close'}</SubmitButton>
                  </form>
                ))}
            </div>
            <hr className="a-sep" />
            <form action={assignAction} className="a-inline">
              <Id id={t.id} />
              <div className="a-field">
                <label htmlFor="as">Assigned to</label>
                <select id="as" name="assignee" defaultValue={t.assignee?.id ?? ''}>
                  <option value="">Nobody</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.id === admin.id ? ' (you)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton className="a-btn ghost">Save</SubmitButton>
            </form>
          </div>
          <div className="a-card">
            <h2 className="a-h2">Customer</h2>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{t.name}</p>
            <p style={{ margin: 0 }}>
              <a className="a-link muted" href={`mailto:${t.email}`}>
                {t.email}
              </a>
            </p>
            <p className="a-small" style={{ margin: '10px 0 0' }}>
              {t.customer ? (
                <Link className="a-link" href={`/admin/customers/${t.customer.id}`}>
                  Open customer record
                </Link>
              ) : (
                'No customer record for this email yet.'
              )}
              {otherTickets > 0 && (
                <>
                  {' · '}
                  <Link className="a-link" href={`/admin/inbox?status=all&q=${encodeURIComponent(t.email)}`}>
                    {otherTickets} other {otherTickets === 1 ? 'conversation' : 'conversations'}
                  </Link>
                </>
              )}
            </p>
          </div>
          {t.orderNumber && (
            <div className="a-card">
              <h2 className="a-h2">Order</h2>
              {order ? (
                <div className="a-kv">
                  <Link className="a-link a-mono" href={`/admin/orders/${order.id}`}>
                    {order.number}
                  </Link>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <OrderPill status={order.status} />
                    <b>{m2(order.total)}</b>
                  </span>
                </div>
              ) : (
                <p className="a-muted" style={{ margin: 0 }}>
                  The customer quoted <span className="a-code">{t.orderNumber}</span>, which does not match an order.
                </p>
              )}
              {order && order.email !== t.email && (
                <p className="a-small" style={{ margin: '8px 0 0' }}>
                  Careful: that order was placed with a different email ({order.email}). Check who you are talking to before sharing order details.
                </p>
              )}
            </div>
          )}
          <div className="a-card">
            <h2 className="a-h2">Customer link</h2>
            <p className="a-small" style={{ margin: 0 }}>
              The customer sees this conversation at{' '}
              <a className="a-link" href={`/support/${t.accessToken}`} target="_blank" rel="noopener">
                their private page ↗
              </a>
              . Do not share the link with anyone else.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
