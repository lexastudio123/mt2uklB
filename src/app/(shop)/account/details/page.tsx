import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountShell, requireCustomer } from '../shell';
import { DetailsForms } from '../forms';

export const metadata: Metadata = { title: 'Account details', robots: { index: false } };

export default async function DetailsPage() {
  const c = await requireCustomer('/account/details');
  return (
    <AccountShell current="/account/details">
      <h2 className="k-h2" style={{ marginBottom: 16 }}>
        Account details
      </h2>
      <DetailsForms name={c.name} email={c.email} phone={c.phone ?? ''} hasPassword={!!c.passwordHash} />
      <h3 className="k-h3" style={{ margin: '30px 0 8px' }}>
        Your data
      </h3>
      <p className="k-small" style={{ margin: '0 0 10px' }}>
        You can ask for a copy of your data or for your account to be deleted at any time.
      </p>
      <Link className="k-link" href="/contact?topic=Something%20else" style={{ fontSize: 14 }}>
        Make a data request
      </Link>
    </AccountShell>
  );
}
