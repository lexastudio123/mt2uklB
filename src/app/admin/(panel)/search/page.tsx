import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { can, requireArea } from '@/lib/admin/perms';
import { sp1, type SP } from '@/lib/admin/queries';
import { AFFILIATE_TONE, fd } from '@/lib/admin/format';
import { AFFILIATE_STATUS_LABEL } from '@/lib/affiliates';
import { m2 } from '@/lib/money';
import { Empty, OrderPill, PageHead, Pill, TicketPill } from '@/components/admin/ui';

export const metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireArea('dashboard');
  const sp = await searchParams;
  const q = sp1(sp, 'q').slice(0, 100);
  if (!q) {
    return (
      <>
        <PageHead title="Search" />
        <Empty title="Type something to search">
          <p style={{ margin: 0 }}>Order numbers, emails, names, postcodes, lot codes, affiliate codes and conversation references.</p>
        </Empty>
      </>
    );
  }
  const up = q.toUpperCase().replace(/\s+/g, '');
  const low = q.toLowerCase();
  // An exact order number or lot code goes straight to the record.
  const exact = await db.order.findUnique({ where: { number: up }, select: { id: true } });
  if (exact) redirect(`/admin/orders/${exact.id}`);

  const [orders, customers, lots, tickets, affiliates] = await Promise.all([
    db.order.findMany({
      where: { OR: [{ number: { contains: up } }, { email: { contains: low } }, { name: { contains: q } }, { shipPostcode: { contains: q.toUpperCase() } }, { trackingNumber: { contains: up } }] },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    db.customer.findMany({ where: { OR: [{ email: { contains: low } }, { name: { contains: q } }, { phone: { contains: q } }, { referralCode: { contains: up } }] }, orderBy: { createdAt: 'desc' }, take: 15 }),
    db.lot.findMany({ where: { code: { contains: up } }, include: { product: { select: { name: true } } }, take: 10 }),
    can(admin, 'inbox')
      ? db.ticket.findMany({ where: { OR: [{ ref: { contains: up } }, { email: { contains: low } }, { name: { contains: q } }, { topic: { contains: q } }] }, orderBy: { lastMessageAt: 'desc' }, take: 15 })
      : Promise.resolve([]),
    can(admin, 'affiliates')
      ? db.affiliate.findMany({
          where: { OR: [{ code: { contains: up } }, { email: { contains: low } }, { name: { contains: q } }, { company: { contains: q } }] },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : Promise.resolve([]),
  ]);
  const none = !orders.length && !customers.length && !lots.length && !tickets.length && !affiliates.length;

  return (
    <div className="a-searchres">
      <PageHead title={`Results for “${q}”`} />
      {none && (
        <Empty title="Nothing found">
          <p style={{ margin: 0 }}>Check the spelling, or search by order number (MT12345), email or postcode.</p>
        </Empty>
      )}
      {orders.length > 0 && (
        <div className="a-card flush" style={{ marginBottom: 16 }}>
          <h2 className="a-h2">Orders</h2>
          <table className="a-table" style={{ marginTop: 10 }}>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link className="a-rowlink a-mono" href={`/admin/orders/${o.id}`}>
                      {o.number}
                    </Link>
                    <span className="a-small">{fd(o.createdAt)}</span>
                  </td>
                  <td>
                    {o.name}
                    <span className="a-small">
                      {o.email} · {o.shipPostcode}
                    </span>
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
      )}
      {customers.length > 0 && (
        <div className="a-card flush" style={{ marginBottom: 16 }}>
          <h2 className="a-h2">Customers</h2>
          <table className="a-table" style={{ marginTop: 10 }}>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link className="a-rowlink" href={`/admin/customers/${c.id}`}>
                      {c.name || c.email}
                    </Link>
                    <span className="a-small">{c.email}</span>
                  </td>
                  <td>{c.blocked ? <Pill tone="red">Blocked</Pill> : <Pill tone={c.passwordHash ? 'green' : ''}>{c.passwordHash ? 'Account' : 'Guest'}</Pill>}</td>
                  <td className="a-small">joined {fd(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lots.length > 0 && (
        <div className="a-card flush" style={{ marginBottom: 16 }}>
          <h2 className="a-h2">Lots</h2>
          <table className="a-table" style={{ marginTop: 10 }}>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link className="a-rowlink a-mono" href={`/admin/lots/${l.id}`}>
                      {l.code}
                    </Link>
                  </td>
                  <td>{l.product.name}</td>
                  <td className="num">{l.purity}%</td>
                  <td>{l.isCurrent ? <Pill tone="green">Current</Pill> : <Pill plain>Archived</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {affiliates.length > 0 && (
        <div className="a-card flush" style={{ marginBottom: 16 }}>
          <h2 className="a-h2">Affiliates</h2>
          <table className="a-table" style={{ marginTop: 10 }}>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link className="a-rowlink" href={`/admin/affiliates/${a.id}`}>
                      {a.name}
                    </Link>
                    <span className="a-small">{a.email}</span>
                  </td>
                  <td>
                    <span className="a-code">{a.code}</span>
                  </td>
                  <td>
                    <Pill tone={AFFILIATE_TONE[a.status] ?? ''}>{AFFILIATE_STATUS_LABEL[a.status] ?? a.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tickets.length > 0 && (
        <div className="a-card flush" style={{ marginBottom: 16 }}>
          <h2 className="a-h2">Conversations</h2>
          <table className="a-table" style={{ marginTop: 10 }}>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link className="a-rowlink" href={`/admin/inbox/${t.id}`}>
                      {t.topic}
                    </Link>
                    <span className="a-small">
                      <span className="a-mono">{t.ref}</span> · {t.name} · {t.email}
                    </span>
                  </td>
                  <td>
                    <TicketPill status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
