import { db } from '@/lib/db';
import { requireArea } from '@/lib/admin/perms';
import { sp1, type SP } from '@/lib/admin/queries';
import { Flash, PageHead } from '@/components/admin/ui';
import { LotFields } from '@/components/admin/lot-form';
import { createLotAction } from '../actions';

export const metadata = { title: 'Add a lot' };

export default async function NewLotPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('lotEdit');
  const sp = await searchParams;
  const products = await db.product.findMany({ where: { kind: 'single' }, select: { id: true, name: true, code: true }, orderBy: { sortOrder: 'asc' } });
  return (
    <>
      <PageHead crumbs={[['Lot reports', '/admin/lots'], ['Add']]} title="Add a lot" sub="Enter the results from the certificate of analysis and upload the certificate itself." />
      <Flash sp={sp} />
      <div className="a-card" style={{ maxWidth: 900 }}>
        <form action={createLotAction}>
          <LotFields products={products} productId={sp1(sp, 'product')} />
        </form>
      </div>
    </>
  );
}
