// Fields for adding or editing an affiliate (server component).
import type { Affiliate } from '@prisma/client';
import { SubmitButton } from './client';

type Props = {
  action: (fd: FormData) => Promise<void>;
  a?: Affiliate;
  code: string;
  commissionPct: number;
  discountPct: number;
  isNew?: boolean;
};

const F = ({ id, label, children, hint, opt }: { id: string; label: string; children: React.ReactNode; hint?: React.ReactNode; opt?: boolean }) => (
  <div className="a-field">
    <label htmlFor={id}>
      {label}
      {opt && <span className="opt"> (optional)</span>}
    </label>
    {children}
    {hint && <span className="hint">{hint}</span>}
  </div>
);

export function AffiliateForm({ action, a, code, commissionPct, discountPct, isNew }: Props) {
  const v = (k: keyof Affiliate) => (a?.[k] as string | null | undefined) ?? '';
  return (
    <form action={action} className="a-form">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="a-row3">
        <F id="afCode" label="Code" hint="Used at checkout and in their link. Letters and numbers only.">
          <input id="afCode" name="code" defaultValue={code} required maxLength={20} style={{ textTransform: 'uppercase' }} className="a-mono" autoComplete="off" />
        </F>
        <F id="afRate" label="Commission (%)" hint="Of the order value after discounts, excluding delivery.">
          <input id="afRate" name="commissionPct" inputMode="decimal" defaultValue={commissionPct} required />
        </F>
        <F id="afDisc" label="Customer discount (%)" hint="0 credits them without a discount.">
          <input id="afDisc" name="discountPct" type="number" min={0} max={50} defaultValue={discountPct} required />
        </F>
      </div>
      <div className="a-row2">
        <F id="afName" label="Name">
          <input id="afName" name="name" defaultValue={v('name')} required maxLength={120} autoComplete="off" />
        </F>
        <F id="afEmail" label="Email">
          <input id="afEmail" name="email" type="email" defaultValue={v('email')} required maxLength={200} autoComplete="off" />
        </F>
        <F id="afPhone" label="Phone" opt>
          <input id="afPhone" name="phone" defaultValue={v('phone')} maxLength={40} autoComplete="off" />
        </F>
        <F id="afCompany" label="Company or trading name" opt>
          <input id="afCompany" name="company" defaultValue={v('company')} maxLength={120} autoComplete="off" />
        </F>
        <F id="afWeb" label="Website or main profile" opt>
          <input id="afWeb" name="website" defaultValue={v('website')} maxLength={300} placeholder="https://" autoComplete="off" />
        </F>
        <F id="afTax" label="Tax reference" opt hint="UTR or VAT number, for your records.">
          <input id="afTax" name="taxRef" defaultValue={v('taxRef')} maxLength={40} autoComplete="off" />
        </F>
      </div>
      <F id="afSocial" label="Other channels" opt>
        <textarea id="afSocial" name="socials" defaultValue={v('socials')} maxLength={1000} style={{ minHeight: 56 }} placeholder="Social accounts, newsletters, forums" />
      </F>
      <fieldset className="a-fieldset">
        <legend>Address</legend>
        <div className="a-row2">
          <F id="afA1" label="Address line 1" opt>
            <input id="afA1" name="addressLine1" defaultValue={v('addressLine1')} maxLength={150} autoComplete="off" />
          </F>
          <F id="afA2" label="Address line 2" opt>
            <input id="afA2" name="addressLine2" defaultValue={v('addressLine2')} maxLength={150} autoComplete="off" />
          </F>
          <F id="afCity" label="Town or city" opt>
            <input id="afCity" name="city" defaultValue={v('city')} maxLength={80} autoComplete="off" />
          </F>
          <div className="a-row2" style={{ gap: 10 }}>
            <F id="afPost" label="Postcode" opt>
              <input id="afPost" name="postcode" defaultValue={v('postcode')} maxLength={12} autoComplete="off" />
            </F>
            <F id="afCountry" label="Country">
              <input id="afCountry" name="country" defaultValue={v('country') || 'United Kingdom'} maxLength={60} autoComplete="off" />
            </F>
          </div>
        </div>
      </fieldset>
      {isNew && (
        <fieldset className="a-fieldset">
          <legend>Bank details for payouts (optional)</legend>
          <p className="a-small" style={{ margin: '0 0 10px' }}>
            They can add these themselves in the affiliate portal.
          </p>
          <div className="a-row2">
            <F id="afBn" label="Name on the account">
              <input id="afBn" name="bankAccountName" maxLength={120} autoComplete="off" />
            </F>
            <div className="a-row2" style={{ gap: 10 }}>
              <F id="afBs" label="Sort code">
                <input id="afBs" name="bankSortCode" maxLength={8} inputMode="numeric" placeholder="12-34-56" className="a-mono" autoComplete="off" />
              </F>
              <F id="afBa" label="Account number">
                <input id="afBa" name="bankAccountNumber" maxLength={10} inputMode="numeric" className="a-mono" autoComplete="off" />
              </F>
            </div>
            <F id="afBi" label="IBAN" opt hint="For accounts outside the UK.">
              <input id="afBi" name="bankIban" maxLength={40} className="a-mono" autoComplete="off" />
            </F>
            <F id="afBb" label="BIC (SWIFT)" opt>
              <input id="afBb" name="bankBic" maxLength={11} className="a-mono" autoComplete="off" />
            </F>
          </div>
        </fieldset>
      )}
      <F id="afNotes" label="Team notes" opt hint="Only the team sees these.">
        <textarea id="afNotes" name="notes" defaultValue={v('notes')} maxLength={4000} style={{ minHeight: 70 }} placeholder="Agreements, audience, anything useful" />
      </F>
      <label className="a-check">
        <input type="checkbox" name="notifySales" defaultChecked={a ? a.notifySales : true} />
        <span>
          Email them for each sale
          <small>They can change this in their portal.</small>
        </span>
      </label>
      {isNew && (
        <label className="a-check">
          <input type="checkbox" name="invite" defaultChecked />
          <span>
            Send a welcome email now
            <small>With their code, link and a button to choose a password for the affiliate portal (valid for 7 days).</small>
          </span>
        </label>
      )}
      <div className="a-formfoot">
        <SubmitButton className="a-btn copper" pending="Saving…">
          {isNew ? 'Add affiliate' : 'Save details'}
        </SubmitButton>
      </div>
    </form>
  );
}
