import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { requireArea } from '@/lib/admin/perms';
import { currentLotCodes, sp1, type SP } from '@/lib/admin/queries';
import { PackingSlip } from '@/components/admin/slip';
import { AutoPrint, PrintButton } from '@/components/admin/client';
import { Empty } from '@/components/admin/ui';

export const metadata = { title: 'Packing slips' };

export default async function SlipsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('orders');
  const sp = await searchParams;
  const raw = sp.ids;
  const ids = (Array.isArray(raw) ? raw : raw ? raw.split(',') : []).filter(Boolean).slice(0, 200);
  const orders = ids.length ? await db.order.findMany({ where: { id: { in: ids } }, include: { items: true }, orderBy: { createdAt: 'asc' } }) : [];
  const [s, lots] = await Promise.all([getSettings(), currentLotCodes([...new Set(orders.flatMap((o) => o.items.map((i) => i.productId).filter(Boolean) as string[]))])]);
  return (
    <>
      <div className="a-head a-noprint">
        <div>
          <nav className="a-crumbs">
            <Link href="/admin/orders">Orders</Link>
            <span>/</span>
            <span>Packing slips</span>
          </nav>
          <h1 className="a-h1">Packing slips</h1>
          <p className="a-sub">{orders.length} {orders.length === 1 ? 'slip' : 'slips'}, one per printed page.</p>
        </div>
        {orders.length > 0 && (
          <div className="a-actions">
            <PrintButton label="Print all" />
          </div>
        )}
      </div>
      {orders.length === 0 ? (
        <Empty title="No orders selected">
          <p style={{ margin: 0 }}>Tick orders on the orders list, then choose “Print packing slips”.</p>
        </Empty>
      ) : (
        orders.map((o) => <PackingSlip key={o.id} o={o} storeName={s.storeName} lots={lots} />)
      )}
      <AutoPrint on={orders.length > 0 && sp1(sp, 'print') === '1'} />
    </>
  );
}
