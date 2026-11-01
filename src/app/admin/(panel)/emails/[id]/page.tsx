import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireArea } from '@/lib/admin/perms';
import { fdt, TEMPLATE_LABEL } from '@/lib/admin/format';
import { Notice, PageHead, Pill } from '@/components/admin/ui';

export const metadata = { title: 'Email' };

export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea('emails');
  const { id } = await params;
  const e = await db.emailLog.findUnique({ where: { id } });
  if (!e) notFound();
  const [order, customer] = await Promise.all([
    e.orderId ? db.order.findUnique({ where: { id: e.orderId }, select: { id: true, number: true } }) : Promise.resolve(null),
    e.customerId ? db.customer.findUnique({ where: { id: e.customerId }, select: { id: true, name: true, email: true } }) : Promise.resolve(null),
  ]);
  return (
    <>
      <PageHead
        crumbs={[['Emails', '/admin/emails'], [TEMPLATE_LABEL[e.template] ?? e.template]]}
        title={e.subject}
        after={<Pill tone={e.status === 'sent' ? 'green' : e.status === 'failed' ? 'red' : 'amber'}>{e.status === 'sent' ? 'Sent' : e.status === 'failed' ? 'Failed' : 'Recorded only'}</Pill>}
        sub={
          <>
            To {e.to} · {fdt(e.createdAt)}
            {order && (
              <>
                {' · '}
                <Link className="a-link" href={`/admin/orders/${order.id}`}>
                  {order.number}
                </Link>
              </>
            )}
            {customer && (
              <>
                {' · '}
                <Link className="a-link" href={`/admin/customers/${customer.id}`}>
                  {customer.name || customer.email}
                </Link>
              </>
            )}
          </>
        }
      />
      {e.error && <Notice tone="err">The mail server said: {e.error}</Notice>}
      {e.html ? (
        <iframe className="a-iframe" title={`Email: ${e.subject}`} srcDoc={e.html} sandbox="" referrerPolicy="no-referrer" />
      ) : (
        <div className="a-empty">
          <b>No preview</b>
          <p style={{ margin: 0 }}>The content of this email was removed (for example after a data erasure request).</p>
        </div>
      )}
    </>
  );
}
