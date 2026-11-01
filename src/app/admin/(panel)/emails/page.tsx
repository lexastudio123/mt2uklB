import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { emailReady } from '@/lib/email/send';
import { requireArea } from '@/lib/admin/perms';
import { PER_PAGE, hrefWith, pageOf, sp1, type SP } from '@/lib/admin/queries';
import { ago, fdt, TEMPLATE_LABEL } from '@/lib/admin/format';
import { Empty, Notice, PageHead, Pager, Pill } from '@/components/admin/ui';
import { AutoSelect } from '@/components/admin/client';

export const metadata = { title: 'Emails' };


const STATUS_TONE: Record<string, string> = { sent: 'green', logged: 'amber', failed: 'red' };
const STATUS_TEXT: Record<string, string> = { sent: 'Sent', logged: 'Recorded only', failed: 'Failed' };

export default async function EmailsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('emails');
  const sp = await searchParams;
  const page = pageOf(sp);
  const q = sp1(sp, 'q');
  const template = sp1(sp, 'template');
  const status = sp1(sp, 'status');
  const where: Prisma.EmailLogWhereInput = {
    ...(q ? { OR: [{ to: { contains: q.toLowerCase() } }, { subject: { contains: q } }] } : {}),
    ...(template ? { template } : {}),
    ...(status ? { status } : {}),
  };
  const [rows, total, templates, failed, mail] = await Promise.all([
    db.emailLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, to: true, subject: true, template: true, status: true, error: true, createdAt: true, orderId: true } }),
    db.emailLog.count({ where }),
    db.emailLog.groupBy({ by: ['template'], _count: { _all: true } }),
    db.emailLog.count({ where: { status: 'failed', createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
    emailReady(),
  ]);
  return (
    <>
      <PageHead title="Emails" sub="Every email the shop has sent or tried to send, newest first." />
      {!mail && (
        <Notice>
          Email sending is not set up yet, so messages are recorded here but not delivered. Add your email provider&apos;s details under{' '}
          <Link className="a-link" href="/admin/settings?tab=connections">
            Settings › Connections
          </Link>
          .
        </Notice>
      )}
      {failed > 0 && <Notice tone="err">{failed} {failed === 1 ? 'email' : 'emails'} failed in the last 7 days. Open one to see the error.</Notice>}
      <form className="a-filters" action="/admin/emails">
        <div className="a-field grow">
          <label htmlFor="eq">Search</label>
          <input id="eq" name="q" defaultValue={q} placeholder="Recipient or subject" />
        </div>
        <div className="a-field">
          <label htmlFor="et">Type</label>
          <AutoSelect name="template" defaultValue={template} label="Email type">
            <option value="">All types</option>
            {templates.map((t) => (
              <option key={t.template} value={t.template}>
                {TEMPLATE_LABEL[t.template] ?? t.template} ({t._count._all})
              </option>
            ))}
          </AutoSelect>
        </div>
        <div className="a-field">
          <label htmlFor="es">Status</label>
          <AutoSelect name="status" defaultValue={status} label="Status">
            <option value="">Any</option>
            <option value="sent">Sent</option>
            <option value="logged">Recorded only</option>
            <option value="failed">Failed</option>
          </AutoSelect>
        </div>
        <button className="a-btn">Search</button>
      </form>
      {rows.length === 0 ? (
        <Empty title="No emails yet">
          <p style={{ margin: 0 }}>Order confirmations, dispatch notes and replies will be listed here.</p>
        </Empty>
      ) : (
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>To</th>
                <th>Type</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td style={{ maxWidth: 380 }}>
                    <Link className="a-rowlink" href={`/admin/emails/${e.id}`}>
                      {e.subject}
                    </Link>
                    {e.error && <span className="a-small" style={{ color: 'var(--a-bad)' }}>{e.error.slice(0, 120)}</span>}
                  </td>
                  <td className="a-small" style={{ color: 'var(--ink)' }}>
                    {e.to}
                  </td>
                  <td className="a-small" style={{ color: 'var(--ink)' }}>
                    {TEMPLATE_LABEL[e.template] ?? e.template}
                  </td>
                  <td>
                    <Pill tone={STATUS_TONE[e.status] ?? ''}>{STATUS_TEXT[e.status] ?? e.status}</Pill>
                  </td>
                  <td className="a-small a-nowrap" style={{ color: 'var(--ink)' }} title={fdt(e.createdAt)}>
                    {ago(e.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} per={PER_PAGE} href={(p) => hrefWith('/admin/emails', sp, { page: p > 1 ? p : null })} />
    </>
  );
}
