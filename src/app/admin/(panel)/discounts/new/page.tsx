import { requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { Flash, PageHead } from '@/components/admin/ui';
import { DiscountFields } from '@/components/admin/discount-form';
import { createDiscountAction } from '../actions';

export const metadata = { title: 'New discount' };

export default async function NewDiscountPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('discounts');
  const sp = await searchParams;
  return (
    <>
      <PageHead crumbs={[['Discounts', '/admin/discounts'], ['New']]} title="New code" />
      <Flash sp={sp} />
      <div className="a-card" style={{ maxWidth: 820 }}>
        <form action={createDiscountAction}>
          <DiscountFields />
        </form>
      </div>
    </>
  );
}
