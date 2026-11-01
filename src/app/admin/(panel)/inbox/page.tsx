import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireArea } from '@/lib/admin/perms';
import { PER_PAGE, hrefWith, pageOf, sp1, type SP } from '@/lib/admin/queries';
import { ago, fdt } from '@/lib/admin/format';
import { Empty, Flash, PageHead, Pager, Tabs, TicketPill } from '@/components/admin/ui';

export const metadata = { title: 'Inbox' };

const TABS: [string, string][] = [
  ['open', 'Open'],
  ['pending', 'Waiting on customer'],
  ['closed', 'Closed'],
  ['all', 'All'],
];

export default async function InboxPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireArea('inbox');
  const sp = await searchParams;
  const page = pageOf(sp);
  const tab = sp1(sp, 'status') || 'open';
  const q = sp1(sp, 'q');
  const mine = sp1(sp, 'mine') === '1';
  const base: Prisma.TicketWhereInput = {
    ...(q
      ? { OR: [{ ref: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }, { name: { contains: q } }, { topic: { contains: q } }, { orderNumber: { contains: q.toUpperCase() } }] }
      : {}),
    ...(mine ? { assigneeId: admin.id } : {}),
  };
  const where: Prisma.TicketWhereInput = { ...base, ...(tab === 'all' ? {} : { status: tab }) };
  const [rows, total, groups, chats] = await Promise.all([
    db.ticket.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 }, assignee: { select: { name: true } } },
    }),
    db.ticket.count({ where }),
    db.ticket.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
    db.chatConversation.count(),
  ]);
  const n = (s: string) => (s === 'all' ? groups.reduce((x, g) => x + g._count._all, 0) : groups.find((g) => g.status === s)?._count._all ?? 0);

  return (
    <>
      <PageHead
        title="Inbox"
        sub="Messages from the contact form and from shoppers who asked the chat assistant for a person. Replies are emailed to the customer."
        actions={
          <Link className="a-btn ghost" href="/admin/inbox/chats">
            Chat transcripts ({chats})
          </Link>
        }
      />
      <Flash sp={sp} />
      <Tabs items={TABS.map(([s, label]) => ({ href: hrefWith('/admin/inbox', sp, { status: s === 'open' ? null : s, page: null }), label, n: n(s), active: tab === s }))} />
      <form className="a-filters" action="/admin/inbox">
        {tab !== 'open' && <input type="hidden" name="status" value={tab} />}
        <div className="a-field grow">
          <label htmlFor="iq">Search</label>
          <input id="iq" name="q" defaultValue={q} placeholder="Reference, email, name, topic or order number" />
        </div>
        <label className="a-check" style={{ alignSelf: 'center', marginTop: 18 }}>
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} />
          Assigned to me
        </label>
        <button className="a-btn">Filter</button>
      </form>
      {rows.length === 0 ? (
        <Empty title={tab === 'open' && !q ? 'Inbox zero' : 'Nothing here'}>
          <p style={{ margin: 0 }}>{tab === 'open' && !q ? 'Every conversation has a reply.' : 'Try another tab or search.'}</p>
        </Empty>
      ) : (
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>From</th>
                <th>Conversation</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Last message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link className="a-rowlink" href={`/admin/inbox/${t.id}`}>
                      {t.name}
                    </Link>
                    <span className="a-small">{t.email}</span>
                  </td>
                  <td style={{ maxWidth: 420 }}>
                    <span className="a-mono" style={{ fontSize: 12.5, color: 'var(--umber)' }}>
                      {t.ref}
                    </span>{' '}
                    <b style={{ fontWeight: 600 }}>{t.topic}</b>
                    {t.orderNumber && <span className="a-code" style={{ marginLeft: 6 }}>{t.orderNumber}</span>}
                    <span className="a-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.messages[0]?.author === 'admin' ? 'You: ' : ''}
                      {t.messages[0]?.body.slice(0, 140)}
                    </span>
                  </td>
                  <td>
                    <TicketPill status={t.status} />
                    {t.channel === 'chat' && <span className="a-small">From chat</span>}
                  </td>
                  <td className="a-small" style={{ color: 'var(--ink)' }}>
                    {t.assignee?.name ?? '·'}
                  </td>
                  <td className="a-small" style={{ color: 'var(--ink)' }} title={fdt(t.lastMessageAt)}>
                    {ago(t.lastMessageAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} per={PER_PAGE} href={(p) => hrefWith('/admin/inbox', sp, { page: p > 1 ? p : null })} />
    </>
  );
}
