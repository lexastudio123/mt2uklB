import type { Metadata } from 'next';
import { requireAffiliate } from '@/lib/affiliate-auth';
import { maskTail, readBank } from '@/lib/affiliates';
import { BankForm, PasswordForm, ProfileForm } from '../../forms';
import { PortalShell } from '../shell';

export const metadata: Metadata = { title: 'Your details', robots: { index: false } };

export default async function DetailsPage() {
  const a = await requireAffiliate('/affiliates/portal/details');
  const bank = readBank(a);
  const masked = bank.complete
    ? [bank.accountName, bank.sortCode ? `sort code ••-••-${bank.sortCode.slice(-2)}, account ${maskTail(bank.accountNumber)}` : `IBAN ${maskTail(bank.iban)}`].join(' · ')
    : null;
  return (
    <PortalShell current="/affiliates/portal/details">
      <section className="k-card">
        <h2 className="k-h2" style={{ fontSize: 22, marginBottom: 16 }}>
          Your details
        </h2>
        <ProfileForm
          email={a.email}
          a={{
            name: a.name,
            phone: a.phone,
            company: a.company,
            website: a.website,
            socials: a.socials,
            addressLine1: a.addressLine1,
            addressLine2: a.addressLine2,
            city: a.city,
            postcode: a.postcode,
            country: a.country,
            taxRef: a.taxRef,
            notifySales: a.notifySales,
          }}
        />
      </section>
      <section className="k-card" id="bank" style={{ marginTop: 18 }}>
        <h2 className="k-h2" style={{ fontSize: 22, marginBottom: 6 }}>
          Bank details for payouts
        </h2>
        <p className="k-mute" style={{ margin: '0 0 16px', fontSize: 14.5 }}>
          {bank.unreadable
            ? 'We cannot read the bank details on file. Please enter them again.'
            : 'Stored securely. Only our finance team can see them in full.'}
        </p>
        <BankForm masked={bank.unreadable ? null : masked} />
      </section>
      <section className="k-card" style={{ marginTop: 18 }}>
        <h2 className="k-h2" style={{ fontSize: 22, marginBottom: 16 }}>
          Password
        </h2>
        <PasswordForm />
      </section>
    </PortalShell>
  );
}
