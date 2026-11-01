import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { ReplyForm } from './form';

export const metadata: Metadata = { title: 'Your conversation', robots: { index: false, follow: false } };

const when = (d: Date) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

/** Private conversation page linked from support emails. */
export default async function SupportThread({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [t, s] = await Promise.all([
    db.ticket.findUnique({ where: { accessToken: token }, include: { messages: { orderBy: { createdAt: 'asc' }, include: { admin: { select: { name: true } } } } } }),
    getSettings(),
  ]);
  if (!t) notFound();
  return (
    <div className="k-page">
      <div className="k-wrap k-narrow">
        <span className={`k-pill ${t.status === 'closed' ? '' : 'warn'}`}>{t.status === 'closed' ? 'Resolved' : t.status === 'pending' ? 'Waiting for you' : 'With the team'}</span>
        <h1 className="k-h1" style={{ marginTop: 12, fontSize: 'clamp(28px,3.4vw,42px)' }}>
          {t.topic}
        </h1>
        <p className="k-small" style={{ marginTop: 8 }}>
          Reference {t.ref}
          {t.orderNumber ? ` · order ${t.orderNumber}` : ''}
        </p>
        <div className="k-thread">
          {t.messages.map((m) => (
            <div key={m.id} className={`m${m.author === 'admin' ? ' team' : ''}`}>
              <div className="by">
                {m.author === 'admin' ? `${(m.admin?.name ?? 'The team').split(' ')[0]} at ${s.storeName}` : 'You'} · {when(m.createdAt)}
              </div>
              <p>{m.body}</p>
            </div>
          ))}
        </div>
        <ReplyForm token={token} />
      </div>
    </div>
  );
}
