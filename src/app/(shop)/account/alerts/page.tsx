import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getCatalog } from '@/lib/catalog';
import { AccountShell, requireCustomer } from '../shell';
import { AlertSwitch } from '../forms';

export const metadata: Metadata = { title: 'Alerts', robots: { index: false } };

export default async function AlertsPage() {
  const c = await requireCustomer('/account/alerts');
  const [catalog, alerts] = await Promise.all([getCatalog(), db.productAlert.findMany({ where: { email: c.email }, select: { productId: true } })]);
  const on = new Set(alerts.map((a) => a.productId));
  return (
    <AccountShell current="/account/alerts">
      <h2 className="k-h2" style={{ marginBottom: 6 }}>
        Alerts
      </h2>
      <p className="k-small" style={{ margin: '0 0 12px' }}>
        We only email when something you chose changes.
      </p>
      <AlertSwitch id="news" title="Offers and new products" sub="One email a fortnight at most" on={c.marketingOptIn} />
      <AlertSwitch id="ship" title="Shipping updates" sub="Dispatch and delivery messages for your orders" on={c.shippingUpdates} />
      <h3 className="k-h3" style={{ margin: '24px 0 4px' }}>
        Restock and new batch alerts
      </h3>
      {catalog.map((p) => (
        <AlertSwitch key={p.id} id={`p-${p.id}`} title={p.fullName} sub="Email me when a new lot is tested or it is back in stock" on={on.has(p.id)} />
      ))}
    </AccountShell>
  );
}
