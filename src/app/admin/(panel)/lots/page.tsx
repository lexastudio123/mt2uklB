import Link from 'next/link';
import { db } from '@/lib/db';
import { can, requireArea } from '@/lib/admin/perms';
import { PER_PAGE, hrefWith, pageOf, sp1, type SP } from '@/lib/admin/queries';
import { fd } from '@/lib/admin/format';
import { Empty, Flash, PageHead, Pager, Pill } from '@/components/admin/ui';
import { AutoSelect } from '@/components/admin/client';

export const metadata = { title: 'Lot reports' };

export default async function LotsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireArea('lots');
  const sp = await searchParams;
  const page = pageOf(sp);
  const product = sp1(sp, 'product');
  const q = sp1(sp, 'q');
  const where = { ...(product ? { productId: product } : {}), ...(q ? { code: { contains: q.toUpperCase() } } : {}) };
  const [lots, total, products] = await Promise.all([
    db.lot.findMany({ where, orderBy: [{ isCurrent: 'desc' }, { testedAt: 'desc' }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { product: { select: { name: true, code: true } } } }),
    db.lot.count({ where }),
    db.product.findMany({ where: { kind: 'single' }, select: { id: true, name: true, code: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  return (
    <>
      <PageHead
        title="Lot reports"
        sub="Each tested lot and its certificate. The current lot of each product is what the shop shows and what you should be shipping."
        actions={
          can(admin, 'lotEdit') ? (
            <Link className="a-btn copper" href={`/admin/lots/new${product ? `?product=${product}` : ''}`}>
              Add a lot
            </Link>
          ) : undefined
        }
      />
      <Flash sp={sp} />
      <form className="a-filters" action="/admin/lots">
        <div className="a-field">
          <label htmlFor="lp">Product</label>
          <AutoSelect name="product" defaultValue={product} label="Product">
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </AutoSelect>
        </div>
        <div className="a-field grow">
          <label htmlFor="lq">Lot code</label>
          <input id="lq" name="q" defaultValue={q} placeholder="MT2-2611" />
        </div>
        <button className="a-btn">Search</button>
      </form>
      {lots.length === 0 ? (
        <Empty title="No lots" action={can(admin, 'lotEdit') ? <Link className="a-btn" href="/admin/lots/new">Add a lot</Link> : undefined}>
          <p style={{ margin: 0 }}>Add each tested lot with its certificate so customers can check the vial they received.</p>
        </Empty>
      ) : (
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Product</th>
                <th className="num">Purity</th>
                <th>Tested</th>
                <th>Certificate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link className="a-rowlink a-mono" href={`/admin/lots/${l.id}`}>
                      {l.code}
                    </Link>
                    {l.lab && <span className="a-small">{l.lab}</span>}
                  </td>
                  <td>{l.product.name}</td>
                  <td className="num">{l.purity}%</td>
                  <td>{fd(l.testedAt)}</td>
                  <td>
                    {l.reportUrl ? (
                      <a className="a-link" href={l.reportUrl} target="_blank" rel="noopener">
                        Open ↗
                      </a>
                    ) : (
                      <span className="a-muted">None</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {l.isCurrent && <Pill tone="green">Current</Pill>}
                    {!l.isPublished && <Pill>Unpublished</Pill>}
                    {l.isSample && <Pill tone="amber">Sample data</Pill>}
                    {!l.isCurrent && l.isPublished && !l.isSample && <Pill plain>Archived</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} per={PER_PAGE} href={(p) => hrefWith('/admin/lots', sp, { page: p > 1 ? p : null })} />
    </>
  );
}
