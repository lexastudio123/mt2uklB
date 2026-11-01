import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireArea } from '@/lib/admin/perms';
import { fdt } from '@/lib/admin/format';
import { parseChat } from '@/lib/admin/chat';
import { PageHead, Pill } from '@/components/admin/ui';

export const metadata = { title: 'Chat transcript' };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea('inbox');
  const { id } = await params;
  const c = await db.chatConversation.findUnique({ where: { id }, include: { customer: { select: { id: true, name: true, email: true } } } });
  if (!c) notFound();
  const msgs = parseChat(c.messages);
  return (
    <>
      <PageHead
        crumbs={[['Inbox', '/admin/inbox'], ['Chat transcripts', '/admin/inbox/chats'], [fdt(c.createdAt)]]}
        title="Chat transcript"
        after={c.flagged ? <Pill tone="amber">Flagged</Pill> : undefined}
        sub={
          <>
            Started {fdt(c.createdAt)} · last message {fdt(c.updatedAt)} ·{' '}
            {c.customer ? (
              <Link className="a-link" href={`/admin/customers/${c.customer.id}`}>
                {c.customer.name || c.customer.email}
              </Link>
            ) : (
              'visitor who was not signed in'
            )}
          </>
        }
      />
      <div className="a-card" style={{ maxWidth: 820 }}>
        {msgs.length ? (
          <div className="a-thread">
            {msgs.map((m, i) => (
              <div key={i} className={`a-msg ${m.role === 'user' ? 'customer' : m.role === 'assistant' ? 'admin' : 'system'}`}>
                <span className="who">
                  {m.role === 'user' ? 'Shopper' : m.role === 'assistant' ? 'Assistant' : 'System'}
                  {m.at ? ` · ${fdt(m.at)}` : ''}
                </span>
                {m.text}
              </div>
            ))}
          </div>
        ) : (
          <p className="a-muted" style={{ margin: 0 }}>
            This transcript is empty (it may have been erased on request).
          </p>
        )}
      </div>
    </>
  );
}
