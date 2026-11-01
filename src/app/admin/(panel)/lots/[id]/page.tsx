import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { can, requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { fd, fdt } from '@/lib/admin/format';
import { Flash, Notice, PageHead, Pill } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import { LotFields } from '@/components/admin/lot-form';
import { deleteLotAction, makeCurrentAction, notifyAlertsAction, removeCertificateAction, updateLotAction } from '../actions';

export const metadata = { title: 'Lot' };

const Id = ({ id }: { id: string }) => <input type="hidden" name="id" value={id} />;

export default async function LotPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const admin = await requireArea('lots');
  const { id } = await params;
  const sp = await searchParams;
  const lot = await db.lot.findUnique({ where: { id }, include: { product: true } });
  if (!lot) notFound();
  const edit = can(admin, 'lotEdit');
  const [products, alertCount, shipped] = await Promise.all([
    db.product.findMany({ where: { kind: 'single' }, select: { id: true, name: true, code: true }, orderBy: { sortOrder: 'asc' } }),
    db.productAlert.count({ where: { productId: lot.productId } }),
    db.orderItem.count({ where: { lotCodes: { contains: lot.code } } }),
  ]);
  const isImage = lot.reportUrl && /\.(png|jpe?g|webp)$/i.test(lot.reportUrl);

  return (
    <>
      <PageHead
        crumbs={[['Lot reports', '/admin/lots'], [lot.code]]}
        title={<span className="a-mono" style={{ fontFamily: 'var(--display)' }}>{lot.code}</span>}
        after={
          <>
            {lot.isCurrent && <Pill tone="green">Current</Pill>}
            {lot.isSample && <Pill tone="amber">Sample data</Pill>}
            {!lot.isPublished && <Pill>Unpublished</Pill>}
          </>
        }
        sub={
          <>
            <Link className="a-link muted" href={`/admin/products/${lot.productId}`}>
              {lot.product.name}
            </Link>{' '}
            · {lot.purity}% · tested {fd(lot.testedAt)} · updated {fdt(lot.updatedAt)}
          </>
        }
        actions={
          lot.isPublished ? (
            <a className="a-btn ghost" href={`/lot-reports/${encodeURIComponent(lot.code)}`} target="_blank" rel="noopener">
              View on shop ↗
            </a>
          ) : undefined
        }
      />
      <Flash sp={sp} />
      {lot.isSample && lot.isCurrent && <Notice>This lot is placeholder data from the design. Add your real lot with its certificate, make it current, then delete this one.</Notice>}

      <div className="a-split">
        <div className="a-card">
          <form action={updateLotAction}>
            <Id id={lot.id} />
            <LotFields lot={lot} products={products} disabled={!edit} />
          </form>
        </div>
        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">Certificate</h2>
            {lot.reportUrl ? (
              <>
                {isImage && (
                  <a href={lot.reportUrl} target="_blank" rel="noopener">
                    <img src={lot.reportUrl} alt={`Certificate for ${lot.code}`} style={{ width: '100%', borderRadius: 4, border: '1px solid var(--a-line)', marginBottom: 10 }} />
                  </a>
                )}
                <p style={{ margin: '0 0 10px' }}>
                  <a className="a-link" href={lot.reportUrl} target="_blank" rel="noopener">
                    Open the certificate ↗
                  </a>
                </p>
                {edit && (
                  <form action={removeCertificateAction}>
                    <Id id={lot.id} />
                    <SubmitButton className="a-link muted" confirm="Remove the certificate file from this lot?">
                      Remove certificate
                    </SubmitButton>
                  </form>
                )}
              </>
            ) : (
              <p className="a-muted" style={{ margin: 0 }}>
                No certificate yet. Upload it with the form. Until then customers only see the numbers.
              </p>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">On the shop</h2>
            {lot.isCurrent ? (
              <p style={{ margin: 0 }}>
                This is the lot shown on the {lot.product.name} page, the home page and the lot reports page. Packing slips suggest it for every new order.
              </p>
            ) : (
              <>
                <p style={{ margin: '0 0 12px' }}>Not current. Make it current when you start shipping vials from this lot.</p>
                {edit && (
                  <form action={makeCurrentAction}>
                    <Id id={lot.id} />
                    <SubmitButton className="a-btn copper" confirm={`Make ${lot.code} the current lot for ${lot.product.name}?`}>
                      Make current
                    </SubmitButton>
                  </form>
                )}
              </>
            )}
            <p className="a-small" style={{ margin: '12px 0 0' }}>
              Recorded on {shipped} order {shipped === 1 ? 'line' : 'lines'}.
            </p>
          </div>

          {edit && lot.isCurrent && (
            <div className="a-card">
              <h2 className="a-h2">Tell subscribers</h2>
              <p style={{ margin: '0 0 12px' }}>
                {alertCount} {alertCount === 1 ? 'person has' : 'people have'} asked to hear about new lots of {lot.product.name}.
              </p>
              <form action={notifyAlertsAction}>
                <Id id={lot.id} />
                <SubmitButton
                  className="a-btn ghost"
                  disabled={!alertCount || lot.isSample}
                  confirm={`Email ${alertCount} ${alertCount === 1 ? 'person' : 'people'} about lot ${lot.code}?`}
                  pending="Sending…"
                >
                  Email the new lot alert
                </SubmitButton>
              </form>
              {lot.isSample && <p className="a-small" style={{ margin: '8px 0 0' }}>Sample lots cannot be announced.</p>}
            </div>
          )}

          {edit && !lot.isCurrent && (
            <div className="a-card a-danger-zone">
              <h2 className="a-h2">Delete</h2>
              <form action={deleteLotAction}>
                <Id id={lot.id} />
                <SubmitButton className="a-btn danger" confirm={`Delete lot ${lot.code} and its certificate? Orders keep the lot code they shipped with.`}>
                  Delete lot
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
