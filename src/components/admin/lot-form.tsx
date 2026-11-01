import type { Lot } from '@prisma/client';
import { toDateInput } from '@/lib/admin/forms';
import { SubmitButton } from './client';

/** Fields shared by the new lot and edit lot pages. */
export function LotFields({ lot, products, productId, disabled }: { lot?: Lot; products: { id: string; name: string; code: string }[]; productId?: string; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="a-form">
      <div className="a-row2">
        <div className="a-field mono">
          <label htmlFor="code">Lot code (as printed on the label)</label>
          <input id="code" name="code" defaultValue={lot?.code} required maxLength={31} placeholder="MT2-2701" />
        </div>
        <div className="a-field">
          <label htmlFor="productId">Product</label>
          <select id="productId" name="productId" defaultValue={lot?.productId ?? productId ?? products[0]?.id}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="a-row3">
        <div className="a-field mono">
          <label htmlFor="purity">Purity by HPLC (%)</label>
          <input id="purity" name="purity" defaultValue={lot?.purity} required inputMode="decimal" placeholder="99.42" />
        </div>
        <div className="a-field mono">
          <label htmlFor="massDa">
            Mass by MS (Da) <span className="opt">(optional)</span>
          </label>
          <input id="massDa" name="massDa" defaultValue={lot?.massDa ?? ''} inputMode="decimal" placeholder="1024.2" />
        </div>
        <div className="a-field">
          <label htmlFor="testedAt">Test date</label>
          <input id="testedAt" name="testedAt" type="date" defaultValue={toDateInput(lot?.testedAt) || toDateInput(new Date())} required />
        </div>
      </div>
      <div className="a-row3">
        <div className="a-field mono">
          <label htmlFor="content">
            Content <span className="opt">(optional)</span>
          </label>
          <input id="content" name="content" defaultValue={lot?.content ?? ''} maxLength={40} placeholder="10.2 mg" />
        </div>
        <div className="a-field mono">
          <label htmlFor="endotoxin">
            Endotoxin <span className="opt">(optional)</span>
          </label>
          <input id="endotoxin" name="endotoxin" defaultValue={lot?.endotoxin ?? ''} maxLength={40} placeholder="<0.5 EU/mg" />
        </div>
        <div className="a-field mono">
          <label htmlFor="retention">
            Main peak (min) <span className="opt">(optional)</span>
          </label>
          <input id="retention" name="retention" defaultValue={lot?.retention ?? ''} inputMode="decimal" placeholder="9.6" />
        </div>
      </div>
      <div className="a-row2">
        <div className="a-field">
          <label htmlFor="lab">
            Testing laboratory <span className="opt">(optional)</span>
          </label>
          <input id="lab" name="lab" defaultValue={lot?.lab ?? ''} maxLength={120} />
        </div>
        <div className="a-field">
          <label htmlFor="certificate">Certificate of analysis {lot?.reportUrl ? '(replace)' : ''}</label>
          <input id="certificate" name="certificate" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" />
          <span className="hint">PDF, PNG, JPG or WEBP up to 10 MB. Customers can open it from the lot report.</span>
        </div>
      </div>
      <div className="a-field">
        <label htmlFor="notes">
          Internal notes <span className="opt">(not shown on the shop)</span>
        </label>
        <textarea id="notes" name="notes" defaultValue={lot?.notes ?? ''} maxLength={2000} style={{ minHeight: 64 }} />
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <label className="a-check">
          <input type="checkbox" name="isPublished" defaultChecked={lot ? lot.isPublished : true} />
          <span>
            Published
            <small>Listed on the lot reports page and found by lot lookup.</small>
          </span>
        </label>
        <label className="a-check">
          <input type="checkbox" name="isSample" defaultChecked={lot?.isSample ?? false} />
          <span>
            Sample data
            <small>Shows a “Sample data” badge. Untick for real results.</small>
          </span>
        </label>
        {!lot && (
          <label className="a-check">
            <input type="checkbox" name="makeCurrent" defaultChecked />
            <span>
              Make this the current lot
              <small>Shown on the product page and home page.</small>
            </span>
          </label>
        )}
      </div>
      {!disabled && (
        <div className="a-formfoot">
          <SubmitButton className="a-btn copper" pending="Saving…">
            {lot ? 'Save lot' : 'Add lot'}
          </SubmitButton>
        </div>
      )}
    </fieldset>
  );
}
