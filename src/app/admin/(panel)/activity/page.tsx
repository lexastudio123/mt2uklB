import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireArea } from '@/lib/admin/perms';
import { PER_PAGE, hrefWith, pageOf, sp1, type SP } from '@/lib/admin/queries';
import { fdt } from '@/lib/admin/format';
import { Empty, PageHead, Pager } from '@/components/admin/ui';
import { AutoSelect } from '@/components/admin/client';

export const metadata = { title: 'Activity' };

const LINK: Record<string, (id: string) => string> = {
  order: (id) => `/admin/orders/${id}`,
  customer: (id) => `/admin/customers/${id}`,
  product: (id) => `/admin/products/${id}`,
  lot: (id) => `/admin/lots/${id}`,
  discount: (id) => `/admin/discounts/${id}`,
  ticket: (id) => `/admin/inbox/${id}`,
  admin: () => '/admin/team',
  settings: (id) => `/admin/settings?tab=${id}`,
};

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('activity');
  const sp = await searchParams;
  const page = pageOf(sp);
  const who = sp1(sp, 'admin');
  const q = sp1(sp, 'q');
  const where: Prisma.ActivityLogWhereInput = {
    ...(who === 'system' ? { adminId: null } : who ? { adminId: who } : {}),
    ...(q ? { OR: [{ action: { contains: q } }, { detail: { contains: q } }] } : {}),
  };
  const [rows, total, team] = await Promise.all([
    db.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { admin: { select: { name: true } } } }),
    db.activityLog.count({ where }),
    db.adminUser.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return (
    <>
      <PageHead title="Activity" sub="Everything the team has changed in the admin, including sign ins and failed sign in attempts." />
      <form className="a-filters" action="/admin/activity">
        <div className="a-field">
          <label htmlFor="aw">Person</label>
          <AutoSelect name="admin" defaultValue={who} label="Person">
            <option value="">Everyone</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="system">No one signed in (failed sign ins)</option>
          </AutoSelect>
        </div>
        <div className="a-field grow">
          <label htmlFor="aq">Search</label>
          <input id="aq" name="q" defaultValue={q} placeholder="e.g. refund, MT12345, login_failed" />
        </div>
        <button className="a-btn">Search</button>
      </form>
      {rows.length === 0 ? (
        <Empty title="Nothing logged yet" />
      ) : (
        <div className="a-tablewrap">
          <table className="a-table compact">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Detail</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = r.entity && r.entityId && LINK[r.entity] ? LINK[r.entity](r.entityId) : null;
                return (
                  <tr key={r.id}>
                    <td className="a-nowrap a-small" style={{ color: 'var(--ink)' }}>
                      {fdt(r.createdAt)}
                    </td>
                    <td>{r.admin?.name ?? <span className="a-muted">·</span>}</td>
                    <td className="a-mono" style={{ fontSize: 12.5 }}>
                      {href ? (
                        <Link className="a-link" href={href}>
                          {r.action}
                        </Link>
                      ) : (
                        r.action
                      )}
                    </td>
                    <td style={{ maxWidth: 460, overflowWrap: 'anywhere' }}>{r.detail}</td>
                    <td className="a-mono a-small">{r.ip}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} per={PER_PAGE} href={(p) => hrefWith('/admin/activity', sp, { page: p > 1 ? p : null })} />
    </>
  );
}
