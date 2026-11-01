import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { AccountShell, requireCustomer } from '../shell';
import { AddressForm } from '../forms';
import { makeDefaultAddress, removeAddress } from '../actions';

export const metadata: Metadata = { title: 'Addresses', robots: { index: false } };

export default async function AddressesPage() {
  const c = await requireCustomer('/account/addresses');
  const addrs = await db.address.findMany({ where: { customerId: c.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  return (
    <AccountShell current="/account/addresses">
      <h2 className="k-h2" style={{ marginBottom: 16 }}>
        Addresses
      </h2>
      {addrs.length ? (
        <div className="k-grid2">
          {addrs.map((a) => (
            <div className="k-card" key={a.id}>
              <b>{a.name}</b>
              {a.isDefault && (
                <span className="k-pill" style={{ marginLeft: 6 }}>
                  Default
                </span>
              )}
              <p className="k-small" style={{ margin: '6px 0 12px' }}>
                {[a.line1, a.line2, a.city, a.postcode, a.country].filter(Boolean).join(', ')}
              </p>
              <div style={{ display: 'flex', gap: 14 }}>
                <form action={removeAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="k-link" style={{ fontSize: 13.5 }}>
                    Remove
                  </button>
                </form>
                {!a.isDefault && (
                  <form action={makeDefaultAddress}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="k-link" style={{ fontSize: 13.5 }}>
                      Make default
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="k-mute" style={{ marginTop: 0 }}>
          No saved addresses yet. Your first order address is saved here automatically.
        </p>
      )}
      <h3 className="k-h3" style={{ margin: '26px 0 12px' }}>
        Add an address
      </h3>
      <AddressForm />
    </AccountShell>
  );
}
