import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { m2, money } from '@/lib/money';
import { cutoffLabel } from '@/lib/eta';
import { EtaLine } from '@/components/shop/bits';
import { KitCrumbs } from '@/components/shop/trust';
import { SupportStrip } from '@/components/shop/support-strip';

export const metadata: Metadata = {
  title: 'Delivery',
  description: 'Same day dispatch on working days, tracked UK delivery in a plain padded envelope, free over the threshold. Prices and times.',
  alternates: { canonical: '/delivery' },
};

export default async function DeliveryPage() {
  const s = await getSettings();
  const methods = s.shipping.methods.filter((m) => m.active);
  return (
    <div className="k-page">
      <div className="k-wrap k-narrow">
        <KitCrumbs items={[['Delivery']]} />
        <h1 className="k-h1">Delivery</h1>
        <p className="k-lede">
          Orders placed before {cutoffLabel(s.shipping.cutoffHour)} UK time on a working day are packed and dispatched the same day. Free tracked delivery on
          orders over {money(s.shipping.freeOver)}.
        </p>
        <div className="k-card" style={{ marginTop: 22 }}>
          <EtaLine />
        </div>
        <h2 className="k-h2" style={{ margin: '34px 0 12px' }}>
          Options in {s.shipping.countries.length === 1 && s.shipping.countries[0] === 'United Kingdom' ? 'the UK' : s.shipping.countries.join(', ')}
        </h2>
        <div className="k-tbl">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Arrives</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.name}</b>
                    <br />
                    <span className="k-small">{m.note}</span>
                  </td>
                  <td>
                    {m.min === m.max ? m.min : `${m.min} to ${m.max}`} working {m.max === 1 ? 'day' : 'days'} after dispatch
                  </td>
                  <td>{m.freeOver ? `${m2(m.price)}, free over ${money(s.shipping.freeOver)}` : m2(m.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="k-small" style={{ marginTop: 10 }}>
          Working days are Monday to Friday, excluding UK bank holidays. Import rules differ by country; we currently deliver to UK addresses only.
        </p>
        <h2 className="k-h2" style={{ margin: '34px 0 10px' }}>
          Packaging
        </h2>
        <p className="k-mute" style={{ lineHeight: 1.7, margin: 0 }}>
          {s.shipping.packaging}
        </p>
        <SupportStrip chat={s.chat.enabled} />
      </div>
    </div>
  );
}
