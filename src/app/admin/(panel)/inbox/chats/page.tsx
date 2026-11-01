import Link from 'next/link';
import { db } from '@/lib/db';
import { requireArea } from '@/lib/admin/perms';
import { PER_PAGE, hrefWith, pageOf, sp1, type SP } from '@/lib/admin/queries';
import { ago, fdt } from '@/lib/admin/format';
import { Empty, PageHead, Pager, Pill } from '@/components/admin/ui';
import { parseChat } from '@/lib/admin/chat';

export const metadata = { title: 'Chat transcripts' };

export default async function ChatsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('inbox');
  const sp = await searchParams;
  const page = pageOf(sp);
  const flagged = sp1(sp, 'flagged') === '1';
  const where = flagged ? { flagged: true } : {};
  const [rows, total] = await Promise.all([
    db.chatConversation.findMany({
      where,
      orderBy: [{ flagged: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { customer: { select: { id: true, name: true, email: true } } },
    }),
    db.chatConversation.count({ where }),
  ]);
  return (
    <>
      <PageHead
        crumbs={[['Inbox', '/admin/inbox'], ['Chat transcripts']]}
        title="Chat transcripts"
        sub="What shoppers asked the assistant. Flagged chats are ones where the assistant declined a dosing or personal-use question. Read only."
        actions={
          <Link className="a-btn ghost" href={flagged ? '/admin/inbox/chats' : '/admin/inbox/chats?flagged=1'}>
            {flagged ? 'Show all' : 'Flagged only'}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <Empty title="No chats yet">
          <p style={{ margin: 0 }}>Conversations with the shop assistant appear here.</p>
        </Empty>
      ) : (
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>First question</th>
                <th className="num">Messages</th>
                <th>Shopper</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const msgs = parseChat(c.messages);
                const firstQ = msgs.find((m) => m.role === 'user')?.text ?? '';
                return (
                  <tr key={c.id}>
                    <td className="a-nowrap">
                      <Link className="a-rowlink" href={`/admin/inbox/chats/${c.id}`}>
                        {fdt(c.createdAt)}
                      </Link>
                      {c.flagged && (
                        <span style={{ display: 'block', marginTop: 2 }}>
                          <Pill tone="amber">Flagged</Pill>
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: 460 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstQ || <span className="a-muted">No question yet</span>}</span>
                    </td>
                    <td className="num">{c.messageCount || msgs.length}</td>
                    <td>
                      {c.customer ? (
                        <Link className="a-link muted" href={`/admin/customers/${c.customer.id}`}>
                          {c.customer.name || c.customer.email}
                        </Link>
                      ) : (
                        <span className="a-muted">Visitor</span>
                      )}
                    </td>
                    <td className="a-small" style={{ color: 'var(--ink)' }}>
                      {ago(c.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} per={PER_PAGE} href={(p) => hrefWith('/admin/inbox/chats', sp, { page: p > 1 ? p : null })} />
    </>
  );
}
