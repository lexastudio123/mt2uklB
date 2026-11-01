import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { can, requireArea } from '@/lib/admin/perms';
import { currentLotCodes, type SP } from '@/lib/admin/queries';
import { EVENT_LABEL, fd, fdt, PAYMENT_LABEL } from '@/lib/admin/format';
import { m2, toPounds } from '@/lib/money';
import { Flash, OrderPill, PageHead, PaymentPill, Pill, Thumb } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import {
  cancelAction,
  deliveredAction,
  dispatchAction,
  markPaidAction,
  noteAction,
  packAction,
  refundAction,
  resendAction,
  updateTrackingAction,
} from '../actions';

export const metadata = { title: 'Order' };

const CARRIERS = ['Royal Mail', 'Parcelforce', 'DPD', 'Evri', 'DHL', 'Other'];
const Id = ({ id }: { id: string }) => <input type="hidden" name="id" value={id} />;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const admin = await requireArea('orders');
  const { id } = await params;
  const sp = await searchParams;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      events: { orderBy: { createdAt: 'desc' }, include: { admin: { select: { name: true } } } },
      customer: { select: { id: true, name: true, email: true, phone: true, passwordHash: true, tags: true, blocked: true, creditPence: true } },
      referrer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!o) notFound();
  const [customerOrders, lotDefaults] = await Promise.all([
    o.customerId ? db.order.count({ where: { customerId: o.customerId } }) : Promise.resolve(0),
    currentLotCodes(o.items.map((i) => i.productId).filter(Boolean) as string[]),
  ]);
  const canRefund = can(admin, 'refunds');
  const remaining = o.total - o.refundedAmount;
  const live = ['awaiting_payment', 'paid', 'packed'].includes(o.status);
  const refundable = o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded';
  const vials = o.items.reduce((n, i) => n + i.vials * i.qty, 0);

  const lotInputs = (
    <div className="a-form" style={{ gap: 10 }}>
      {o.items.map((it) => (
        <div key={it.id} className="a-field mono">
          <label htmlFor={`lot_${it.id}`}>
            Lot for {it.qty} × {it.productName} <span className="opt">({it.packLabel.split(' · ')[0]})</span>
          </label>
          <input id={`lot_${it.id}`} name={`lot_${it.id}`} defaultValue={it.lotCodes ?? (it.productId ? lotDefaults.get(it.productId) ?? '' : '')} placeholder="e.g. MT2-2611" />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <PageHead
        crumbs={[['Orders', '/admin/orders'], [o.number]]}
        title={<span className="a-mono" style={{ fontFamily: 'var(--display)' }}>{o.number}</span>}
        after={<OrderPill status={o.status} />}
        sub={
          <>
            Placed {fdt(o.createdAt)} · {PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod} · {vials} {vials === 1 ? 'vial' : 'vials'} · <b style={{ color: 'var(--ink)' }}>{m2(o.total)}</b>
          </>
        }
        actions={
          <>
            <a className="a-btn ghost" href={`/invoice/${o.accessToken}`} target="_blank" rel="noopener">
              Invoice
            </a>
            <a className="a-btn ghost" href={`/admin/orders/${o.id}/slip?print=1`} target="_blank" rel="noopener">
              Packing slip
            </a>
            <a className="a-btn ghost" href={`/order/${o.accessToken}`} target="_blank" rel="noopener">
              Customer view ↗
            </a>
          </>
        }
      />
      <Flash sp={sp} />

      <div className="a-split">
        <div className="a-stack">
          {/* ───── Next step ───── */}
          {o.status === 'awaiting_payment' && (
            <div className="a-card tint">
              <h2 className="a-h2">Next step · confirm payment</h2>
              {o.paymentMethod === 'bank_transfer' ? (
                <p style={{ margin: '0 0 14px' }}>
                  Waiting for a bank transfer of <b>{m2(o.total)}</b> with reference <span className="a-code">{o.number}</span>. When it reaches the account, mark the order as paid. The
                  customer gets their confirmation and the order moves to “To pack”.
                </p>
              ) : (
                <p style={{ margin: '0 0 14px' }}>
                  The customer was sent to the secure card payment page. Stripe confirms the payment automatically. Only mark it paid by hand if you can see the payment in Stripe.
                </p>
              )}
              <form action={markPaidAction} className="a-form">
                <Id id={o.id} />
                <div className="a-field">
                  <label htmlFor="pnote">
                    Payment note <span className="opt">(optional)</span>
                  </label>
                  <input id="pnote" name="note" placeholder="e.g. Received 2 Nov, Barclays, ref MT12345" maxLength={200} />
                </div>
                <label className="a-check">
                  <input type="checkbox" name="notify" defaultChecked />
                  Email the customer their order confirmation
                </label>
                <div className="a-formfoot">
                  <SubmitButton className="a-btn copper" pending="Saving…">
                    Mark as paid
                  </SubmitButton>
                </div>
              </form>
            </div>
          )}

          {(o.status === 'paid' || o.status === 'packed') && (
            <div className="a-card tint">
              <h2 className="a-h2">{o.status === 'paid' ? 'Next step · pack and dispatch' : 'Next step · dispatch'}</h2>
              <form action={dispatchAction} className="a-form">
                <Id id={o.id} />
                {lotInputs}
                <div className="a-row2">
                  <div className="a-field">
                    <label htmlFor="carrier">Carrier</label>
                    <select id="carrier" name="carrier" defaultValue="Royal Mail">
                      {CARRIERS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="a-field mono">
                    <label htmlFor="tracking">
                      Tracking number <span className="opt">(optional)</span>
                    </label>
                    <input id="tracking" name="tracking" placeholder="e.g. AB123456789GB" maxLength={60} />
                  </div>
                </div>
                <label className="a-check">
                  <input type="checkbox" name="notify" defaultChecked />
                  Email the customer that it is on its way
                </label>
                <div className="a-formfoot">
                  <SubmitButton className="a-btn copper" pending="Dispatching…">
                    Dispatch
                  </SubmitButton>
                  <SubmitButton className="a-btn ghost" formAction={packAction} pending="Saving…">
                    {o.status === 'paid' ? 'Mark packed only' : 'Save lot numbers'}
                  </SubmitButton>
                </div>
              </form>
            </div>
          )}

          {(o.status === 'dispatched' || o.status === 'delivered') && (
            <div className="a-card tint">
              <h2 className="a-h2">{o.status === 'dispatched' ? 'On its way' : 'Delivered'}</h2>
              <dl className="a-dl">
                <dt>Dispatched</dt>
                <dd>{fdt(o.dispatchedAt)}</dd>
                <dt>Carrier</dt>
                <dd>{o.trackingCarrier || '·'}</dd>
                <dt>Tracking</dt>
                <dd>
                  {o.trackingNumber ? (
                    o.trackingUrl ? (
                      <a className="a-link a-mono" href={o.trackingUrl} target="_blank" rel="noopener">
                        {o.trackingNumber} ↗
                      </a>
                    ) : (
                      <span className="a-mono">{o.trackingNumber}</span>
                    )
                  ) : (
                    'No tracking number'
                  )}
                </dd>
                {o.deliveredAt && (
                  <>
                    <dt>Delivered</dt>
                    <dd>{fdt(o.deliveredAt)}</dd>
                  </>
                )}
              </dl>
              {o.status === 'dispatched' && (
                <form action={deliveredAction} className="a-formfoot" style={{ marginTop: 14 }}>
                  <Id id={o.id} />
                  <SubmitButton className="a-btn copper" pending="Saving…">
                    Mark as delivered
                  </SubmitButton>
                </form>
              )}
              <details className="a-details" style={{ marginTop: 14 }}>
                <summary>Edit tracking details</summary>
                <form action={updateTrackingAction} className="a-form">
                  <Id id={o.id} />
                  <div className="a-row2">
                    <div className="a-field">
                      <label htmlFor="carrier2">Carrier</label>
                      <select id="carrier2" name="carrier" defaultValue={CARRIERS.includes(o.trackingCarrier ?? '') ? o.trackingCarrier! : 'Other'}>
                        {CARRIERS.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="a-field mono">
                      <label htmlFor="tracking2">Tracking number</label>
                      <input id="tracking2" name="tracking" defaultValue={o.trackingNumber ?? ''} maxLength={60} />
                    </div>
                  </div>
                  <div className="a-field">
                    <label htmlFor="turl">
                      Tracking link <span className="opt">(filled in for Royal Mail)</span>
                    </label>
                    <input id="turl" name="trackingUrl" defaultValue={o.trackingUrl ?? ''} placeholder="https://" />
                  </div>
                  <div className="a-formfoot">
                    <SubmitButton className="a-btn ghost">Save tracking</SubmitButton>
                  </div>
                </form>
              </details>
            </div>
          )}

          {o.status === 'cancelled' && (
            <div className="a-card tint">
              <h2 className="a-h2">Cancelled {fd(o.cancelledAt)}</h2>
              {refundable ? (
                <p style={{ margin: 0 }}>This order was paid. Refund the payment using the refund form on the right.</p>
              ) : (
                <>
                  <p style={{ margin: '0 0 12px' }}>No payment was taken. If a bank transfer arrives after all, marking it paid reopens the order and reserves the stock again.</p>
                  <form action={markPaidAction} className="a-inline">
                    <Id id={o.id} />
                    <input type="hidden" name="notify" value="on" />
                    <div className="a-field">
                      <label htmlFor="pnote2">
                        Payment note <span className="opt">(optional)</span>
                      </label>
                      <input id="pnote2" name="note" maxLength={200} />
                    </div>
                    <SubmitButton className="a-btn ghost" confirm="Reopen this order as paid and reserve its stock again?">
                      Mark as paid and reopen
                    </SubmitButton>
                  </form>
                </>
              )}
            </div>
          )}

          {o.status === 'refunded' && (
            <div className="a-card tint">
              <h2 className="a-h2">Refunded</h2>
              <p style={{ margin: 0 }}>
                {m2(o.refundedAmount)} refunded {fd(o.refundedAt)}.
              </p>
            </div>
          )}

          {/* ───── Items ───── */}
          <div className="a-card flush">
            <h2 className="a-h2">Items</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="a-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th className="num">Each</th>
                    <th>Lot</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <span className="a-cellflex">
                          <Thumb src={it.image} />
                          <span style={{ minWidth: 0 }}>
                            {it.productId ? (
                              <Link className="a-rowlink" href={`/admin/products/${it.productId}`}>
                                {it.productName}
                              </Link>
                            ) : (
                              <b>{it.productName}</b>
                            )}
                            <span className="a-small">{it.packLabel}</span>
                          </span>
                        </span>
                      </td>
                      <td className="num">{it.qty}</td>
                      <td className="num">{m2(it.unitPrice)}</td>
                      <td className="a-mono" style={{ fontSize: 13 }}>
                        {it.lotCodes || <span className="a-muted">·</span>}
                      </td>
                      <td className="num">{m2(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="a-totals">
              <div>
                <span>Subtotal</span>
                <span>{m2(o.subtotal)}</span>
              </div>
              {o.discount > 0 && (
                <div>
                  <span>Discount {o.discountCode && <span className="a-code">{o.discountCode}</span>}</span>
                  <span>−{m2(o.discount)}</span>
                </div>
              )}
              {o.credit > 0 && (
                <div>
                  <span>Store credit</span>
                  <span>−{m2(o.credit)}</span>
                </div>
              )}
              <div>
                <span>Delivery · {o.shippingMethodName}</span>
                <span>{o.shipping ? m2(o.shipping) : 'Free'}</span>
              </div>
              <div className="grand">
                <span>Total</span>
                <span>{m2(o.total)}</span>
              </div>
              {o.refundedAmount > 0 && (
                <div style={{ color: 'var(--a-bad)' }}>
                  <span>Refunded</span>
                  <span>−{m2(o.refundedAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ───── Timeline ───── */}
          <div className="a-card">
            <h2 className="a-h2">Timeline</h2>
            <form action={noteAction} className="a-form" style={{ marginBottom: 18 }}>
              <Id id={o.id} />
              <div className="a-field">
                <label htmlFor="note" className="a-sr">
                  Internal note
                </label>
                <textarea id="note" name="body" placeholder="Add an internal note. Customers never see these." style={{ minHeight: 64 }} maxLength={2000} />
              </div>
              <div className="a-formfoot">
                <SubmitButton className="a-btn ghost sm">Add note</SubmitButton>
              </div>
            </form>
            <ol className="a-tl">
              {o.events.map((e) => (
                <li key={e.id} className={e.type}>
                  <div className="msg">
                    {e.type === 'note' ? <b>Note: </b> : null}
                    {e.message}
                  </div>
                  <div className="meta">
                    {EVENT_LABEL[e.type] ?? e.type} · {e.admin?.name ?? 'System'} · {fdt(e.createdAt)}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* ───── Side column ───── */}
        <div className="a-stack">
          <div className="a-card">
            <h2 className="a-h2">
              Customer {o.customer && <Link href={`/admin/customers/${o.customer.id}`}>Open</Link>}
            </h2>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{o.name}</p>
            <p style={{ margin: 0 }}>
              <a className="a-link muted" href={`mailto:${o.email}`}>
                {o.email}
              </a>
            </p>
            {o.phone && <p style={{ margin: '2px 0 0' }}>{o.phone}</p>}
            {o.customer && (
              <p className="a-small" style={{ margin: '10px 0 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Pill tone={o.customer.passwordHash ? 'green' : ''}>{o.customer.passwordHash ? 'Has an account' : 'Guest'}</Pill>
                <Pill plain>{customerOrders === 1 ? 'First order' : `${customerOrders} orders`}</Pill>
                {o.customer.blocked && <Pill tone="red">Blocked</Pill>}
              </p>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">Delivery</h2>
            <p className="a-address">
              {o.name}
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
              <b className="a-mono">{o.shipPostcode}</b>
              <br />
              {o.shipCountry}
            </p>
            <p className="a-small" style={{ margin: '10px 0 0' }}>
              {o.shippingMethodName}
              {o.etaFrom ? `, expected ${fd(o.etaFrom)}` : ''}
            </p>
            {!o.billSame && (
              <>
                <hr className="a-sep" />
                <h3 className="a-h3">Billing address</h3>
                <p className="a-address">
                  {o.billLine1}
                  <br />
                  {o.billCity}
                  <br />
                  {o.billPostcode}
                </p>
              </>
            )}
            {o.customerNote && (
              <>
                <hr className="a-sep" />
                <h3 className="a-h3">Customer note</h3>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{o.customerNote}</p>
              </>
            )}
          </div>

          <div className="a-card">
            <h2 className="a-h2">Payment</h2>
            <dl className="a-dl">
              <dt>Status</dt>
              <dd>
                <PaymentPill status={o.paymentStatus} />
              </dd>
              <dt>Method</dt>
              <dd>{o.paymentDetail || PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod}</dd>
              {o.paidAt && (
                <>
                  <dt>Paid</dt>
                  <dd>{fdt(o.paidAt)}</dd>
                </>
              )}
              {o.paymentRef && (
                <>
                  <dt>Checkout ref</dt>
                  <dd className="a-mono" style={{ fontSize: 12.5 }}>
                    {o.paymentRef}
                  </dd>
                </>
              )}
              {o.paymentIntent && (
                <>
                  <dt>Payment ID</dt>
                  <dd className="a-mono" style={{ fontSize: 12.5 }}>
                    {o.paymentIntent}
                  </dd>
                </>
              )}
              {o.discountCode && (
                <>
                  <dt>Code</dt>
                  <dd>
                    <span className="a-code">{o.discountCode}</span>
                    {o.referrer && (
                      <>
                        {' '}
                        referred by{' '}
                        <Link className="a-link" href={`/admin/customers/${o.referrer.id}`}>
                          {o.referrer.name || o.referrer.email}
                        </Link>
                      </>
                    )}
                  </dd>
                </>
              )}
              <dt>Research use</dt>
              <dd>{o.ruoConfirmed ? 'Confirmed at checkout' : 'Not confirmed'}</dd>
              <dt>Marketing</dt>
              <dd>{o.marketingOptIn ? 'Opted in' : 'No'}</dd>
            </dl>
          </div>

          <div className="a-card">
            <h2 className="a-h2">Emails</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {o.status === 'awaiting_payment' && o.paymentMethod === 'bank_transfer' && (
                <form action={resendAction}>
                  <Id id={o.id} />
                  <input type="hidden" name="kind" value="received_bank" />
                  <SubmitButton className="a-btn ghost sm block" confirm={`Send the bank details to ${o.email} again?`}>
                    Resend bank details
                  </SubmitButton>
                </form>
              )}
              {o.paymentStatus !== 'unpaid' && (
                <form action={resendAction}>
                  <Id id={o.id} />
                  <input type="hidden" name="kind" value="confirmed" />
                  <SubmitButton className="a-btn ghost sm block" confirm={`Send the order confirmation to ${o.email} again?`}>
                    Resend order confirmation
                  </SubmitButton>
                </form>
              )}
              {(o.status === 'dispatched' || o.status === 'delivered') && (
                <form action={resendAction}>
                  <Id id={o.id} />
                  <input type="hidden" name="kind" value="dispatched" />
                  <SubmitButton className="a-btn ghost sm block" confirm={`Send the dispatch email to ${o.email} again?`}>
                    Resend dispatch email
                  </SubmitButton>
                </form>
              )}
              <Link className="a-link muted" href={`/admin/emails?q=${encodeURIComponent(o.email)}`} style={{ fontSize: 13 }}>
                See every email sent to this customer
              </Link>
            </div>
          </div>

          {live && (
            <div className="a-card a-danger-zone">
              <h2 className="a-h2">Cancel order</h2>
              <form action={cancelAction} className="a-form">
                <Id id={o.id} />
                <div className="a-field">
                  <label htmlFor="creason">
                    Reason <span className="opt">(shown to the customer)</span>
                  </label>
                  <input id="creason" name="reason" maxLength={300} placeholder="e.g. at your request" />
                </div>
                <label className="a-check">
                  <input type="checkbox" name="restock" defaultChecked />
                  Put the stock back
                </label>
                <label className="a-check">
                  <input type="checkbox" name="notify" defaultChecked />
                  Email the customer
                </label>
                {refundable && <p className="a-small" style={{ margin: 0 }}>This order is paid. Cancelling does not refund it: issue the refund below as well.</p>}
                <SubmitButton className="a-btn danger" confirm={`Cancel order ${o.number}?`} pending="Cancelling…">
                  Cancel order
                </SubmitButton>
              </form>
            </div>
          )}

          {refundable && canRefund && (
            <div className="a-card a-danger-zone">
              <h2 className="a-h2">Refund</h2>
              <p className="a-small" style={{ margin: '0 0 12px' }}>
                {o.paymentMethod === 'card' && o.paymentIntent
                  ? 'The money goes back to the card through Stripe straight away.'
                  : 'Send the money back by bank transfer yourself, then record it here.'}
              </p>
              <form action={refundAction} className="a-form">
                <Id id={o.id} />
                <div className="a-field mono">
                  <label htmlFor="ramount">Amount (£)</label>
                  <input id="ramount" name="amount" inputMode="decimal" defaultValue={toPounds(remaining)} />
                  <span className="hint">Up to {m2(remaining)}</span>
                </div>
                <div className="a-field">
                  <label htmlFor="rreason">
                    Reason <span className="opt">(optional)</span>
                  </label>
                  <input id="rreason" name="reason" maxLength={300} />
                </div>
                <label className="a-check">
                  <input type="checkbox" name="restock" />
                  Put the stock back (sealed vials returned)
                </label>
                <label className="a-check">
                  <input type="checkbox" name="notify" defaultChecked />
                  Email the customer
                </label>
                <SubmitButton className="a-btn danger" confirm="Record this refund? Card refunds are sent immediately." pending="Refunding…">
                  Refund
                </SubmitButton>
              </form>
            </div>
          )}

          <div className="a-card">
            <h2 className="a-h2">Details</h2>
            <dl className="a-dl" style={{ fontSize: 13 }}>
              <dt>Placed</dt>
              <dd>
                {fdt(o.createdAt)}
                {o.placedSignedIn ? ', signed in' : ', as guest'}
              </dd>
              <dt>IP address</dt>
              <dd className="a-mono">{o.ip || '·'}</dd>
              <dt>Browser</dt>
              <dd className="a-small">{o.userAgent || '·'}</dd>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
