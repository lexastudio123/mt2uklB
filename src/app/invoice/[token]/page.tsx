import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { m2 } from '@/lib/money';
import { PrintButton } from './print';

export const metadata: Metadata = { title: 'Invoice', robots: { index: false, follow: false } };

const fdate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });

/** Printable invoice (or pro forma while unpaid). Reached through the order's private link. */
export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [order, s] = await Promise.all([db.order.findUnique({ where: { accessToken: token }, include: { items: true } }), getSettings()]);
  if (!order) notFound();
  const paid = ['paid', 'packed', 'dispatched', 'delivered', 'refunded'].includes(order.status) || order.paymentStatus !== 'unpaid';
  const co = s.company;
  const vatIncluded = s.company.vatNumber ? Math.round(order.total - order.total / (1 + s.vatRate / 100)) : 0;
  const bill = order.billSame
    ? [order.name, order.shipLine1, order.shipLine2, order.shipCity, order.shipPostcode, order.shipCountry]
    : [order.name, order.billLine1, order.billCity, order.billPostcode];
  const ship = [order.name, order.shipLine1, order.shipLine2, order.shipCity, order.shipPostcode, order.shipCountry];

  return (
    <div className="inv">
      <div className="inv-bar">
        <PrintButton />
      </div>
      <div className="inv-page">
        <header className="inv-head">
          <div>
            <div className="inv-logo">
              MT2 LAB<small>UK</small>
            </div>
            <p>
              {co.name}
              <br />
              {co.address}
              <br />
              Company number {co.number}
              {co.vatNumber && (
                <>
                  <br />
                  VAT {co.vatNumber}
                </>
              )}
              <br />
              {s.supportEmail}
            </p>
          </div>
          <div className="inv-meta">
            <h1>{paid ? 'Invoice' : 'Pro forma invoice'}</h1>
            <dl>
              <dt>Invoice number</dt>
              <dd>{order.number}</dd>
              <dt>Date</dt>
              <dd>{fdate(order.paidAt ?? order.createdAt)}</dd>
              <dt>Status</dt>
              <dd>{order.paymentStatus === 'refunded' ? 'Refunded' : order.paymentStatus === 'partially_refunded' ? 'Partly refunded' : paid ? 'Paid' : 'Awaiting payment'}</dd>
              {order.paymentDetail && (
                <>
                  <dt>Payment</dt>
                  <dd>{order.paymentDetail}</dd>
                </>
              )}
            </dl>
          </div>
        </header>
        <div className="inv-addrs">
          <div>
            <h2>Bill to</h2>
            <p>
              {bill.filter(Boolean).map((l, i) => (
                <span key={i}>
                  {l}
                  <br />
                </span>
              ))}
              {order.email}
            </p>
          </div>
          <div>
            <h2>Ship to</h2>
            <p>
              {ship.filter(Boolean).map((l, i) => (
                <span key={i}>
                  {l}
                  <br />
                </span>
              ))}
            </p>
          </div>
        </div>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>
                  <b>{i.productName}</b>
                  <br />
                  <span>
                    {i.packLabel}
                    {i.lotCodes ? ` · Lot ${i.lotCodes}` : ''}
                  </span>
                </td>
                <td>{i.qty}</td>
                <td>{m2(i.unitPrice)}</td>
                <td>{m2(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="inv-tots">
          <tbody>
            <tr>
              <td>Subtotal</td>
              <td>{m2(order.subtotal)}</td>
            </tr>
            {order.discount > 0 && (
              <tr>
                <td>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</td>
                <td>−{m2(order.discount)}</td>
              </tr>
            )}
            <tr>
              <td>Delivery ({order.shippingMethodName})</td>
              <td>{order.shipping ? m2(order.shipping) : 'Free'}</td>
            </tr>
            {order.credit > 0 && (
              <tr>
                <td>Store credit</td>
                <td>−{m2(order.credit)}</td>
              </tr>
            )}
            <tr className="grand">
              <td>Total (GBP)</td>
              <td>{m2(order.total)}</td>
            </tr>
            {vatIncluded > 0 && (
              <tr>
                <td>Includes VAT at {s.vatRate}%</td>
                <td>{m2(vatIncluded)}</td>
              </tr>
            )}
            {order.refundedAmount > 0 && (
              <tr>
                <td>Refunded</td>
                <td>−{m2(order.refundedAmount)}</td>
              </tr>
            )}
          </tbody>
        </table>
        {!paid && s.payments.bankTransfer.accountNumber && (
          <div className="inv-note">
            <b>Pay by bank transfer:</b> {s.payments.bankTransfer.accountName} · sort code {s.payments.bankTransfer.sortCode} · account {s.payments.bankTransfer.accountNumber} ·
            reference {order.number}
          </div>
        )}
        <p className="inv-foot">
          Products are supplied for in vitro laboratory research only and are not for human or veterinary use. {s.storeName} is a trading name of {co.name}, registered in{' '}
          {co.jurisdiction}.
        </p>
      </div>
    </div>
  );
}
