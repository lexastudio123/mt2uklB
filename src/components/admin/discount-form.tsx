import type { DiscountCode } from '@prisma/client';
import { toDateInput } from '@/lib/admin/forms';
import { toPounds } from '@/lib/money';
import { SubmitButton } from './client';

export function DiscountFields({ d }: { d?: DiscountCode }) {
  return (
    <div className="a-form">
      <div className="a-row2">
        <div className="a-field mono">
          <label htmlFor="code">Code</label>
          <input id="code" name="code" defaultValue={d?.code} required maxLength={40} placeholder="SPRING15" style={{ textTransform: 'uppercase' }} />
        </div>
        <div className="a-field">
          <label htmlFor="description">
            Note for the team <span className="opt">(optional)</span>
          </label>
          <input id="description" name="description" defaultValue={d?.description ?? ''} maxLength={200} placeholder="e.g. Spring newsletter" />
        </div>
      </div>
      <div className="a-row3">
        <div className="a-field">
          <label htmlFor="kind">Type</label>
          <select id="kind" name="kind" defaultValue={d?.kind ?? 'percent'}>
            <option value="percent">Percentage off</option>
            <option value="fixed">Amount off (£)</option>
          </select>
        </div>
        <div className="a-field mono">
          <label htmlFor="value">Value</label>
          <input id="value" name="value" required inputMode="decimal" defaultValue={d ? (d.kind === 'fixed' ? toPounds(d.value) : String(d.value)) : ''} placeholder="10" />
          <span className="hint">10 means 10% or £10.</span>
        </div>
        <div className="a-field mono">
          <label htmlFor="minSubtotal">
            Minimum spend £ <span className="opt">(optional)</span>
          </label>
          <input id="minSubtotal" name="minSubtotal" inputMode="decimal" defaultValue={d && d.minSubtotal ? toPounds(d.minSubtotal) : ''} />
        </div>
      </div>
      <div className="a-row3">
        <div className="a-field mono">
          <label htmlFor="maxUses">
            Maximum uses <span className="opt">(optional)</span>
          </label>
          <input id="maxUses" name="maxUses" type="number" min={1} defaultValue={d?.maxUses ?? ''} />
        </div>
        <div className="a-field">
          <label htmlFor="startsAt">
            Starts <span className="opt">(optional)</span>
          </label>
          <input id="startsAt" name="startsAt" type="date" defaultValue={toDateInput(d?.startsAt ? new Date(+d.startsAt + 12 * 36e5) : null)} />
        </div>
        <div className="a-field">
          <label htmlFor="endsAt">
            Ends <span className="opt">(optional, inclusive)</span>
          </label>
          <input id="endsAt" name="endsAt" type="date" defaultValue={toDateInput(d?.endsAt)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <label className="a-check">
          <input type="checkbox" name="firstOrderOnly" defaultChecked={d?.firstOrderOnly ?? false} />
          <span>
            First order only
            <small>Checked against the email address at checkout.</small>
          </span>
        </label>
        <label className="a-check">
          <input type="checkbox" name="active" defaultChecked={d?.active ?? true} />
          Active
        </label>
      </div>
      <div className="a-formfoot">
        <SubmitButton className="a-btn copper" pending="Saving…">
          {d ? 'Save code' : 'Create code'}
        </SubmitButton>
      </div>
    </div>
  );
}
