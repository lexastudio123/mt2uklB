import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import type { Research } from '@/lib/catalog-types';
import { can, requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { fd, fdt } from '@/lib/admin/format';
import { toPounds } from '@/lib/money';
import { Flash, Notice, PageHead, Pill } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import {
  addBundleItemAction,
  adjustStockAction,
  deletePackAction,
  removeBundleItemAction,
  savePackAction,
  stockSettingsAction,
  updateProductAction,
} from '../actions';

export const metadata = { title: 'Product' };

const Id = ({ id }: { id: string }) => <input type="hidden" name="id" value={id} />;

function parse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

const REASON: Record<string, string> = { order: 'Order', cancel: 'Order cancelled', refund: 'Refund restock', restock: 'Delivery in', adjustment: 'Adjustment', damaged: 'Damaged or lost', count: 'Stock count' };

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const admin = await requireArea('products');
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.product.findUnique({
    where: { id },
    include: {
      packs: { orderBy: { qty: 'asc' }, include: { _count: { select: { orderItems: true } } } },
      lots: { orderBy: { testedAt: 'desc' }, take: 5 },
      bundleItems: { include: { product: { select: { id: true, name: true, code: true, stock: true, trackStock: true } } } },
      stockMovements: { orderBy: { createdAt: 'desc' }, take: 25, include: { admin: { select: { name: true } } } },
    },
  });
  if (!p) notFound();
  const edit = can(admin, 'productEdit');
  const research = parse<Partial<Research>>(p.research, {});
  const highlights = parse<string[]>(p.highlights, []);
  const singles = p.kind === 'bundle' ? await db.product.findMany({ where: { kind: 'single' }, select: { id: true, name: true, code: true }, orderBy: { sortOrder: 'asc' } }) : [];
  const orderIds = p.stockMovements.map((m) => m.orderId).filter(Boolean) as string[];
  const orderNumbers = orderIds.length ? new Map((await db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })).map((o) => [o.id, o.number])) : new Map<string, string>();
  const current = p.lots.find((l) => l.isCurrent);

  return (
    <>
      <PageHead
        crumbs={[['Products', '/admin/products'], [p.name]]}
        title={p.name}
        after={p.active ? <Pill tone="green">Live</Pill> : <Pill>Hidden</Pill>}
        sub={
          <>
            <span className="a-mono">{p.code}</span> · {p.kind === 'bundle' ? 'Bundle' : 'Single vial'} · updated {fdt(p.updatedAt)}
          </>
        }
        actions={
          <a className="a-btn ghost" href={`/products/${p.slug}`} target="_blank" rel="noopener">
            View on shop ↗
          </a>
        }
      />
      <Flash sp={sp} />
      {!edit && <Notice>You can view products. Ask an admin to change prices, stock or content.</Notice>}

      <div className="a-split">
        <form action={updateProductAction} className="a-stack">
          <Id id={p.id} />
          <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="a-stack">
            <div className="a-card">
              <h2 className="a-h2">Product</h2>
              <div className="a-form">
                <div className="a-row2">
                  <div className="a-field">
                    <label htmlFor="name">Name</label>
                    <input id="name" name="name" defaultValue={p.name} required maxLength={80} />
                  </div>
                  <div className="a-field">
                    <label htmlFor="fullName">Full name (basket and invoices)</label>
                    <input id="fullName" name="fullName" defaultValue={p.fullName} required maxLength={120} />
                  </div>
                </div>
                <div className="a-row3">
                  <div className="a-field mono">
                    <label htmlFor="code">Short code</label>
                    <input id="code" name="code" defaultValue={p.code} required maxLength={12} />
                  </div>
                  <div className="a-field mono">
                    <label htmlFor="slug">Web address</label>
                    <input id="slug" name="slug" defaultValue={p.slug} required maxLength={80} />
                    <span className="hint">/products/{p.slug}</span>
                  </div>
                  <div className="a-field">
                    <label htmlFor="altName">
                      Other name <span className="opt">(optional)</span>
                    </label>
                    <input id="altName" name="altName" defaultValue={p.altName ?? ''} maxLength={80} placeholder="afamelanotide" />
                  </div>
                </div>
                <div className="a-row2">
                  <div className="a-field">
                    <label htmlFor="tagline">Small heading above the title</label>
                    <input id="tagline" name="tagline" defaultValue={p.tagline} maxLength={80} />
                  </div>
                  <div className="a-field">
                    <label htmlFor="badge">
                      Badge <span className="opt">(optional)</span>
                    </label>
                    <input id="badge" name="badge" defaultValue={p.badge ?? ''} maxLength={30} placeholder="Bestseller" />
                  </div>
                </div>
                <div className="a-field">
                  <label htmlFor="lede">Introduction</label>
                  <textarea id="lede" name="lede" defaultValue={p.lede} maxLength={600} />
                </div>
                <div className="a-field">
                  <label htmlFor="highlights">Key points (one per line, up to 6)</label>
                  <textarea id="highlights" name="highlights" defaultValue={highlights.join('\n')} style={{ minHeight: 80 }} />
                </div>
                <div className="a-row2">
                  <div className="a-field">
                    <label htmlFor="searchTerms">Search words</label>
                    <input id="searchTerms" name="searchTerms" defaultValue={p.searchTerms} maxLength={400} />
                    <span className="hint">Extra words people might search for.</span>
                  </div>
                  <div className="a-field">
                    <label htmlFor="sortOrder">Order on the shop</label>
                    <input id="sortOrder" name="sortOrder" type="number" min={0} max={1000} defaultValue={p.sortOrder} />
                    <span className="hint">Lower numbers come first.</span>
                  </div>
                </div>
                <label className="a-check">
                  <input type="checkbox" name="active" defaultChecked={p.active} />
                  <span>
                    Show on the shop
                    <small>Hidden products cannot be bought, but past orders are unaffected.</small>
                  </span>
                </label>
              </div>
            </div>

            <div className="a-card">
              <h2 className="a-h2">Images</h2>
              <div className="a-form">
                <div className="a-row2">
                  <div className="a-field">
                    <label htmlFor="image">Main image</label>
                    <input id="image" name="image" defaultValue={p.image} className="a-mono" maxLength={300} />
                    <input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload a new main image" />
                  </div>
                  <div style={{ background: 'var(--husk)', borderRadius: 6, height: 150, position: 'relative', overflow: 'hidden' }}>
                    <img src={p.image} alt="" style={{ position: 'absolute', left: '50%', bottom: '-6%', transform: 'translateX(-50%)', height: p.imageWide ? 'auto' : '100%', width: p.imageWide ? '90%' : 'auto' }} />
                  </div>
                </div>
                <label className="a-check">
                  <input type="checkbox" name="imageWide" defaultChecked={p.imageWide} />
                  Wide image (several vials side by side)
                </label>
                <div className="a-field">
                  <label htmlFor="packImage">
                    Extra gallery image <span className="opt">(optional, e.g. a 5 vial pack)</span>
                  </label>
                  <input id="packImage" name="packImage" defaultValue={p.packImage ?? ''} className="a-mono" maxLength={300} />
                  <input name="packImageFile" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload an extra gallery image" />
                </div>
              </div>
            </div>

            <div className="a-card">
              <h2 className="a-h2">Specification</h2>
              <div className="a-form">
                <div className="a-field mono">
                  <label htmlFor="sequence">Sequence</label>
                  <input id="sequence" name="sequence" defaultValue={p.sequence ?? ''} maxLength={200} />
                </div>
                <div className="a-row3">
                  <div className="a-field">
                    <label htmlFor="structure">Structure</label>
                    <input id="structure" name="structure" defaultValue={p.structure ?? ''} maxLength={120} />
                  </div>
                  <div className="a-field mono">
                    <label htmlFor="massDa">Molecular mass (Da)</label>
                    <input id="massDa" name="massDa" defaultValue={p.massDa ?? ''} maxLength={20} />
                  </div>
                  <div className="a-field mono">
                    <label htmlFor="contentMg">Content per vial (mg)</label>
                    <input id="contentMg" name="contentMg" type="number" min={1} defaultValue={p.contentMg} />
                  </div>
                </div>
                <div className="a-row3">
                  <div className="a-field">
                    <label htmlFor="form">Form</label>
                    <input id="form" name="form" defaultValue={p.form} maxLength={160} />
                  </div>
                  <div className="a-field">
                    <label htmlFor="vial">Vial</label>
                    <input id="vial" name="vial" defaultValue={p.vial ?? ''} maxLength={160} />
                  </div>
                  <div className="a-field">
                    <label htmlFor="storage">Storage</label>
                    <input id="storage" name="storage" defaultValue={p.storage} maxLength={160} />
                  </div>
                </div>
              </div>
            </div>

            <div className="a-card">
              <h2 className="a-h2">Research summary</h2>
              <p className="a-small" style={{ margin: '-4px 0 14px' }}>
                Shown in the Research tab. Keep it factual: what the compound is and what published studies looked at. Never dosing, usage or results to expect.
              </p>
              <div className="a-form">
                <div className="a-row2">
                  <div className="a-field">
                    <label htmlFor="level">Licensing status</label>
                    <select id="level" name="level" defaultValue={research.level ?? 'pre'}>
                      <option value="pre">Unlicensed research compound</option>
                      <option value="lic">Licensed medicine elsewhere</option>
                    </select>
                  </div>
                  <div className="a-field">
                    <label htmlFor="levelLabel">Status label</label>
                    <input id="levelLabel" name="levelLabel" defaultValue={research.levelLabel ?? ''} maxLength={120} />
                  </div>
                </div>
                <div className="a-field">
                  <label htmlFor="what">What it is</label>
                  <textarea id="what" name="what" defaultValue={research.what ?? ''} maxLength={1500} />
                </div>
                <div className="a-field">
                  <label htmlFor="findings">What the research shows (one point per line)</label>
                  <textarea id="findings" name="findings" defaultValue={(research.findings ?? []).join('\n')} style={{ minHeight: 120 }} />
                </div>
                <div className="a-field">
                  <label htmlFor="warning">Regulator warning</label>
                  <textarea id="warning" name="warning" defaultValue={research.warning ?? ''} maxLength={1500} />
                </div>
                <div className="a-field">
                  <label htmlFor="searchTerm">Search term for study links (PubMed, ClinicalTrials.gov)</label>
                  <input id="searchTerm" name="searchTerm" defaultValue={research.searchTerm ?? ''} maxLength={80} />
                </div>
              </div>
            </div>

            <div className="a-card">
              <h2 className="a-h2">Search engines</h2>
              <div className="a-form">
                <div className="a-field">
                  <label htmlFor="seoTitle">
                    Page title <span className="opt">(optional)</span>
                  </label>
                  <input id="seoTitle" name="seoTitle" defaultValue={p.seoTitle ?? ''} maxLength={120} />
                </div>
                <div className="a-field">
                  <label htmlFor="seoDescription">
                    Description <span className="opt">(optional, about 155 characters)</span>
                  </label>
                  <textarea id="seoDescription" name="seoDescription" defaultValue={p.seoDescription ?? ''} maxLength={320} style={{ minHeight: 70 }} />
                </div>
              </div>
            </div>

            {edit && (
              <div className="a-formfoot" style={{ position: 'sticky', bottom: 0, background: 'var(--a-bg)', padding: '12px 0', zIndex: 2 }}>
                <SubmitButton className="a-btn copper" pending="Saving…">
                  Save product
                </SubmitButton>
                <span className="a-small">Images upload when you save.</span>
              </div>
            )}
          </fieldset>
        </form>

        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">Pack sizes and prices</h2>
            <p className="a-small" style={{ margin: '-4px 0 6px' }}>
              Prices include VAT. Each pack has a fixed price; savings are worked out against the single price.
            </p>
            {p.packs.map((k) => (
              <form key={k.id} action={savePackAction} className="a-packrow">
                <Id id={p.id} />
                <input type="hidden" name="packId" value={k.id} />
                <fieldset disabled={!edit} style={{ display: 'contents' }}>
                  <div className="a-field mono">
                    <label htmlFor={`q-${k.id}`}>Qty</label>
                    <input id={`q-${k.id}`} name="qty" type="number" min={1} max={100} defaultValue={k.qty} />
                  </div>
                  <div className="a-field mono">
                    <label htmlFor={`p-${k.id}`}>Price £</label>
                    <input id={`p-${k.id}`} name="price" inputMode="decimal" defaultValue={toPounds(k.price)} />
                  </div>
                  <div className="a-field">
                    <label htmlFor={`t-${k.id}`}>Tag</label>
                    <input id={`t-${k.id}`} name="tag" defaultValue={k.tag ?? ''} maxLength={30} placeholder="Best value" />
                  </div>
                  <label className="a-check" style={{ marginBottom: 10 }}>
                    <input type="checkbox" name="active" defaultChecked={k.active} />
                    On sale
                  </label>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <SubmitButton className="a-btn ghost sm">Save</SubmitButton>
                    <SubmitButton
                      className="a-btn danger sm"
                      formAction={deletePackAction}
                      confirm={k._count.orderItems ? `This pack has ${k._count.orderItems} order lines, so it will be hidden rather than deleted. Continue?` : `Delete the pack of ${k.qty}?`}
                    >
                      ✕
                    </SubmitButton>
                  </span>
                </fieldset>
              </form>
            ))}
            {edit && (
              <form action={savePackAction} className="a-packrow" style={{ background: '#FBF6EF', margin: '6px -20px -18px', padding: '14px 20px', borderRadius: '0 0 6px 6px' }}>
                <Id id={p.id} />
                <div className="a-field mono">
                  <label htmlFor="nq">Qty</label>
                  <input id="nq" name="qty" type="number" min={1} max={100} placeholder="20" />
                </div>
                <div className="a-field mono">
                  <label htmlFor="np">Price £</label>
                  <input id="np" name="price" inputMode="decimal" placeholder="300.00" />
                </div>
                <div className="a-field">
                  <label htmlFor="nt">Tag</label>
                  <input id="nt" name="tag" maxLength={30} />
                </div>
                <span />
                <SubmitButton className="a-btn sm">Add pack</SubmitButton>
              </form>
            )}
          </div>

          {p.kind === 'bundle' ? (
            <div className="a-card">
              <h2 className="a-h2">Bundle contents</h2>
              <p className="a-small" style={{ margin: '-4px 0 10px' }}>
                Selling one bundle takes these vials from each product&apos;s stock. The bundle&apos;s own stock number is not used.
              </p>
              {p.bundleItems.map((b) => (
                <div key={b.id} className="a-kv">
                  <span>
                    {b.qty} × <Link className="a-link" href={`/admin/products/${b.product.id}`}>{b.product.name}</Link>
                    <span className="a-small">{b.product.trackStock ? `${b.product.stock} in stock` : 'stock not tracked'}</span>
                  </span>
                  {edit && (
                    <form action={removeBundleItemAction}>
                      <Id id={p.id} />
                      <input type="hidden" name="itemId" value={b.id} />
                      <SubmitButton className="a-link muted" confirm={`Remove ${b.product.name} from the bundle?`}>
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                </div>
              ))}
              {edit && (
                <form action={addBundleItemAction} className="a-inline" style={{ marginTop: 12 }}>
                  <Id id={p.id} />
                  <div className="a-field">
                    <label htmlFor="bp">Product</label>
                    <select id="bp" name="productId">
                      {singles.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="a-field mono" style={{ maxWidth: 90 }}>
                    <label htmlFor="bq">Qty</label>
                    <input id="bq" name="qty" type="number" min={1} max={20} defaultValue={1} />
                  </div>
                  <SubmitButton className="a-btn ghost">Add</SubmitButton>
                </form>
              )}
            </div>
          ) : (
            <div className="a-card">
              <h2 className="a-h2">Stock</h2>
              <div className="a-kpi" style={{ border: 0, padding: 0, marginBottom: 14 }}>
                <span>On the shelf</span>
                <b>{p.trackStock ? `${p.stock} ${p.stock === 1 ? 'vial' : 'vials'}` : 'Not tracked'}</b>
                {p.trackStock && p.stock <= p.lowStock && <small style={{ color: 'var(--a-warn)' }}>At or below the low stock level of {p.lowStock}</small>}
              </div>
              <form action={stockSettingsAction} className="a-inline">
                <Id id={p.id} />
                <fieldset disabled={!edit} style={{ display: 'contents' }}>
                  <label className="a-check" style={{ marginBottom: 10 }}>
                    <input type="checkbox" name="trackStock" defaultChecked={p.trackStock} />
                    Track stock
                  </label>
                  <div className="a-field mono" style={{ maxWidth: 140 }}>
                    <label htmlFor="ls">Low stock at</label>
                    <input id="ls" name="lowStock" type="number" min={0} defaultValue={p.lowStock} />
                  </div>
                  <SubmitButton className="a-btn ghost">Save</SubmitButton>
                </fieldset>
              </form>
              {edit && p.trackStock && (
                <>
                  <hr className="a-sep" />
                  <form action={adjustStockAction} className="a-form">
                    <Id id={p.id} />
                    <div className="a-row2">
                      <div className="a-field mono">
                        <label htmlFor="sd">Add or remove vials</label>
                        <input id="sd" name="delta" type="number" placeholder="+100 or -2" />
                      </div>
                      <div className="a-field">
                        <label htmlFor="sr">Reason</label>
                        <select id="sr" name="reason" defaultValue="restock">
                          <option value="restock">Delivery in</option>
                          <option value="count">Stock count correction</option>
                          <option value="damaged">Damaged or lost</option>
                          <option value="adjustment">Other adjustment</option>
                        </select>
                      </div>
                    </div>
                    <div className="a-field">
                      <label htmlFor="sn">
                        Note <span className="opt">(optional)</span>
                      </label>
                      <input id="sn" name="note" maxLength={200} placeholder="e.g. lot MT2-2701 received" />
                    </div>
                    <div className="a-formfoot">
                      <SubmitButton className="a-btn">Update stock</SubmitButton>
                    </div>
                  </form>
                </>
              )}
              {p.stockMovements.length > 0 && (
                <details className="a-details" style={{ marginTop: 14 }}>
                  <summary>Stock history</summary>
                  <table className="a-table compact">
                    <tbody>
                      {p.stockMovements.map((m) => (
                        <tr key={m.id}>
                          <td className="a-small" style={{ color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                            {fd(m.createdAt)}
                          </td>
                          <td>
                            {REASON[m.reason] ?? m.reason}
                            {m.orderId && orderNumbers.get(m.orderId) && (
                              <>
                                {' '}
                                <Link className="a-link a-mono" href={`/admin/orders/${m.orderId}`} style={{ fontSize: 12.5 }}>
                                  {orderNumbers.get(m.orderId)}
                                </Link>
                              </>
                            )}
                            {(m.note || m.admin) && (
                              <span className="a-small">
                                {m.note}
                                {m.note && m.admin ? ' · ' : ''}
                                {m.admin?.name}
                              </span>
                            )}
                          </td>
                          <td className="num" style={{ color: m.delta < 0 ? 'var(--a-bad)' : 'var(--a-good)' }}>
                            {m.delta > 0 ? '+' : ''}
                            {m.delta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          )}

          {p.kind !== 'bundle' && (
            <div className="a-card">
              <h2 className="a-h2">
                Lot reports <Link href={`/admin/lots?product=${p.id}`}>All lots</Link>
              </h2>
              {current ? (
                <p style={{ margin: '0 0 8px' }}>
                  Shipping now:{' '}
                  <Link className="a-link a-mono" href={`/admin/lots/${current.id}`}>
                    {current.code}
                  </Link>{' '}
                  · {current.purity}% · tested {fd(current.testedAt)} {current.isSample && <Pill tone="amber">Sample data</Pill>}
                </p>
              ) : (
                <p style={{ margin: '0 0 8px', color: 'var(--a-bad)' }}>No current lot. The product page shows no report until you mark one as current.</p>
              )}
              {can(admin, 'lotEdit') && (
                <Link className="a-btn ghost sm" href={`/admin/lots/new?product=${p.id}`}>
                  Add a lot
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
