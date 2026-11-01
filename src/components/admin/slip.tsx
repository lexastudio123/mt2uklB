import type { Order, OrderItem } from '@prisma/client';
import { fd } from '@/lib/admin/format';

/** One printable packing slip. No prices: it goes in the parcel. */
export function PackingSlip({ o, storeName, lots }: { o: Order & { items: OrderItem[] }; storeName: string; lots: Map<string, string> }) {
  const vials = o.items.reduce((n, i) => n + i.vials * i.qty, 0);
  return (
    <section className="a-slip">
      <div className="a-slip-head">
        <div>
          <div className="a-slip-logo">
            MT2 LAB<small>UK</small>
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Packing slip · {storeName}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 14 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 600 }}>{o.number}</div>
          <div>Ordered {fd(o.createdAt)}</div>
          <div>{o.shippingMethodName}</div>
        </div>
      </div>
      <div className="a-slip-to">
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>Deliver to</div>
        <b>{o.name}</b>
        <br />
        {o.shipLine1}
        {o.shipLine2 && (
          <>
            <br />
            {o.shipLine2}
          </>
        )}
        <br />
        {o.shipCity}
        <br />
        <b>{o.shipPostcode}</b>
        <br />
        {o.shipCountry}
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 60 }}>Qty</th>
            <th>Item</th>
            <th>Vials</th>
            <th>Lot</th>
            <th style={{ width: 40 }}>✓</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((it) => (
            <tr key={it.id}>
              <td style={{ fontWeight: 700, fontSize: 16 }}>{it.qty} ×</td>
              <td>
                <b>{it.productName}</b>
                <br />
                <span style={{ fontSize: 12.5 }}>{it.packLabel.split(' · ')[0]}</span>
              </td>
              <td>{it.vials * it.qty}</td>
              <td style={{ fontFamily: 'var(--mono)' }}>{it.lotCodes || (it.productId && lots.get(it.productId)) || <span className="lotline" />}</td>
              <td>
                <span style={{ display: 'inline-block', width: 16, height: 16, border: '1.5px solid #000' }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 13.5, margin: '10px 0 0' }}>
        <b>{vials}</b> {vials === 1 ? 'vial' : 'vials'} in total. Pack in a padded sleeve inside a plain padded envelope.
      </p>
      {o.customerNote && (
        <p style={{ fontSize: 13.5, margin: '10px 0 0' }}>
          <b>Customer note:</b> {o.customerNote}
        </p>
      )}
      <div className="a-slip-sign">
        <span style={{ border: 0, minWidth: 0, margin: 0 }}>
          Packed by <span />
        </span>
        <span style={{ border: 0, minWidth: 0, margin: 0 }}>
          Checked by <span />
        </span>
      </div>
      <div className="a-slip-foot">
        <span>For laboratory research use only. Not for human or veterinary use.</span>
        <span>Questions about this order? Quote {o.number}.</span>
      </div>
    </section>
  );
}
