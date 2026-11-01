import { requireArea } from '@/lib/admin/perms';
import type { SP } from '@/lib/admin/queries';
import { Flash, PageHead } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import { createProductAction } from '../actions';

export const metadata = { title: 'New product' };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireArea('productEdit');
  const sp = await searchParams;
  return (
    <>
      <PageHead crumbs={[['Products', '/admin/products'], ['New']]} title="New product" sub="Start with the essentials. The product stays hidden until you finish the details and tick “Show on the shop”." />
      <Flash sp={sp} />
      <div className="a-card" style={{ maxWidth: 760 }}>
        <form action={createProductAction} className="a-form">
          <div className="a-row2">
            <div className="a-field">
              <label htmlFor="n">Name</label>
              <input id="n" name="name" required maxLength={80} placeholder="e.g. Melanotan II" />
            </div>
            <div className="a-field">
              <label htmlFor="fn">
                Full name <span className="opt">(shown in the basket)</span>
              </label>
              <input id="fn" name="fullName" maxLength={120} placeholder="e.g. Melanotan II 10 mg" />
            </div>
          </div>
          <div className="a-row3">
            <div className="a-field mono">
              <label htmlFor="c">Short code</label>
              <input id="c" name="code" required maxLength={12} placeholder="MT2" />
            </div>
            <div className="a-field mono">
              <label htmlFor="s">
                Web address <span className="opt">(optional)</span>
              </label>
              <input id="s" name="slug" maxLength={80} placeholder="melanotan-ii" />
            </div>
            <div className="a-field">
              <label htmlFor="k">Type</label>
              <select id="k" name="kind" defaultValue="single">
                <option value="single">Single vial</option>
                <option value="bundle">Bundle of other products</option>
              </select>
            </div>
          </div>
          <div className="a-row2">
            <div className="a-field mono">
              <label htmlFor="p">Price for one (£)</label>
              <input id="p" name="price" required inputMode="decimal" placeholder="21.00" />
              <span className="hint">Add bigger pack sizes on the next page.</span>
            </div>
            <div className="a-field">
              <label htmlFor="if">Image</label>
              <input id="if" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" />
              <span className="hint">PNG, JPG or WEBP with a transparent or dark background, up to 10 MB. Or type a path below.</span>
            </div>
          </div>
          <div className="a-field mono">
            <label htmlFor="ip">
              Image path <span className="opt">(if not uploading)</span>
            </label>
            <input id="ip" name="image" placeholder="/img/mt2.webp" maxLength={300} />
          </div>
          <div className="a-formfoot">
            <SubmitButton className="a-btn copper" pending="Creating…">
              Create product
            </SubmitButton>
          </div>
        </form>
      </div>
    </>
  );
}
