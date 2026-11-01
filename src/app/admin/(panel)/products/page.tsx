import Link from 'next/link';
import { db } from '@/lib/db';
import { can, requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { fd } from '@/lib/admin/format';
import { m2 } from '@/lib/money';
import { Empty, Flash, PageHead, Pill, Thumb } from '@/components/admin/ui';

export const metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireArea('products');
  const sp = await searchParams;
  const products = await db.product.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      packs: { orderBy: { qty: 'asc' } },
      lots: { where: { isCurrent: true }, take: 1 },
      bundleItems: { include: { product: { select: { code: true, stock: true, trackStock: true } } } },
      _count: { select: { orderItems: true } },
    },
  });
  return (
    <>
      <PageHead
        title="Products"
        sub="What the shop sells, at what price, and how much is on the shelf. Stock is counted in vials; bundles draw from their components."
        actions={
          can(admin, 'productEdit') ? (
            <Link className="a-btn copper" href="/admin/products/new">
              New product
            </Link>
          ) : undefined
        }
      />
      <Flash sp={sp} />
      {products.length === 0 ? (
        <Empty title="No products" action={<Link className="a-btn" href="/admin/products/new">Add the first product</Link>} />
      ) : (
        <div className="a-tablewrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Packs and prices</th>
                <th className="num">Stock</th>
                <th>Current lot</th>
                <th className="num">Sold lines</th>
                <th>Shop</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const active = p.packs.filter((k) => k.active);
                const bundleStock =
                  p.kind === 'bundle' && p.bundleItems.length
                    ? Math.min(...p.bundleItems.filter((b) => b.product.trackStock).map((b) => Math.floor(b.product.stock / b.qty)))
                    : null;
                const low = p.trackStock && p.stock <= p.lowStock;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="a-cellflex">
                        <Thumb src={p.image} wide={p.imageWide} />
                        <span>
                          <Link className="a-rowlink" href={`/admin/products/${p.id}`}>
                            {p.name}
                          </Link>
                          <span className="a-small">
                            <span className="a-mono">{p.code}</span> · /products/{p.slug}
                            {p.kind === 'bundle' ? ' · bundle' : ''}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="a-small" style={{ color: 'var(--ink)' }}>
                      {active.length ? active.map((k) => `${k.qty} for ${m2(k.price)}`).join(' · ') : <span style={{ color: 'var(--a-bad)' }}>No active packs</span>}
                    </td>
                    <td className="num">
                      {p.kind === 'bundle' ? (
                        <span title="Limited by the component with the least stock">{Number.isFinite(bundleStock ?? NaN) ? `${bundleStock} sets` : '·'}</span>
                      ) : p.trackStock ? (
                        <>
                          {p.stock}
                          {low && (
                            <span style={{ display: 'block', marginTop: 2 }}>
                              <Pill tone="amber">Low</Pill>
                            </span>
                          )}
                        </>
                      ) : (
                        'Not tracked'
                      )}
                    </td>
                    <td>
                      {p.kind === 'bundle' ? (
                        <span className="a-small">From components</span>
                      ) : p.lots[0] ? (
                        <Link className="a-link a-mono" href={`/admin/lots/${p.lots[0].id}`} style={{ fontSize: 13 }}>
                          {p.lots[0].code}
                        </Link>
                      ) : (
                        <span className="a-small" style={{ color: 'var(--a-bad)' }}>
                          None
                        </span>
                      )}
                      {p.lots[0]?.isSample && (
                        <span style={{ display: 'block', marginTop: 2 }}>
                          <Pill tone="amber">Sample data</Pill>
                        </span>
                      )}
                      {p.lots[0] && <span className="a-small">tested {fd(p.lots[0].testedAt)}</span>}
                    </td>
                    <td className="num">{p._count.orderItems}</td>
                    <td>{p.active ? <Pill tone="green">Live</Pill> : <Pill>Hidden</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
