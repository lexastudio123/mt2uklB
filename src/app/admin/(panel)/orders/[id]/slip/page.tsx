import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { requireArea } from '@/lib/admin/perms';
import { currentLotCodes, sp1, type SP } from '@/lib/admin/queries';
import { PackingSlip } from '@/components/admin/slip';
import { AutoPrint, PrintButton } from '@/components/admin/client';

export const metadata = { title: 'Packing slip' };

export default async function SlipPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requireArea('orders');
  const { id } = await params;
  const sp = await searchParams;
  const o = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!o) notFound();
  const [s, lots] = await Promise.all([getSettings(), currentLotCodes(o.items.map((i) => i.productId).filter(Boolean) as string[])]);
  return (
    <>
      <div className="a-head a-noprint">
        <div>
          <nav className="a-crumbs">
            <Link href="/admin/orders">Orders</Link>
            <span>/</span>
            <Link href={`/admin/orders/${o.id}`}>{o.number}</Link>
            <span>/</span>
            <span>Packing slip</span>
          </nav>
          <h1 className="a-h1">Packing slip</h1>
        </div>
        <div className="a-actions">
          <PrintButton />
        </div>
      </div>
      <PackingSlip o={o} storeName={s.storeName} lots={lots} />
      <AutoPrint on={sp1(sp, 'print') === '1'} />
    </>
  );
}
