import { getSettings } from '@/lib/settings';
import { requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { Flash, PageHead } from '@/components/admin/ui';
import { AffiliateForm } from '@/components/admin/affiliate-form';
import { createAffiliateAction } from '../actions';

export const metadata = { title: 'Add affiliate' };

export default async function NewAffiliatePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('affiliateEdit');
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  return (
    <>
      <PageHead
        crumbs={[['Affiliates', '/admin/affiliates'], ['Add affiliate']]}
        title="Add affiliate"
        sub="For partners you have agreed terms with directly. They start active, and their code works straight away."
      />
      <Flash sp={sp} />
      <div className="a-card" style={{ maxWidth: 900 }}>
        <AffiliateForm action={createAffiliateAction} code="" commissionPct={s.affiliates.commissionPct} discountPct={s.affiliates.discountPct} isNew />
      </div>
    </>
  );
}
