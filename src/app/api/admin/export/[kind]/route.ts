import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { can } from '@/lib/admin/perms';
import { csvResponse, pounds } from '@/lib/admin/csv';
import { customerTotals, customersWhere, ordersWhere, type SP } from '@/lib/admin/queries';
import { EMPTY_BALANCE, balances, readBank } from '@/lib/affiliates';

const MAX = 50_000;

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const admin = await getAdmin();
  if (!admin || !can(admin, 'export')) return new Response('Forbidden', { status: 403 });
  const { kind } = await params;
  const sp: SP = Object.fromEntries(new URL(req.url).searchParams);

  if (kind === 'orders') {
    const orders = await db.order.findMany({ where: ordersWhere(sp), orderBy: { createdAt: 'desc' }, include: { items: true }, take: MAX });
    await logActivity(admin.id, 'export.orders', 'order', undefined, `${orders.length} rows`);
    return csvResponse('orders', [
      ['Order', 'Placed', 'Status', 'Payment method', 'Payment status', 'Paid at', 'Name', 'Email', 'Phone', 'Address 1', 'Address 2', 'Town', 'Postcode', 'Country', 'Items', 'Vials', 'Subtotal', 'Discount', 'Code', 'Credit', 'Delivery', 'Delivery method', 'Total', 'Refunded', 'Tracking', 'Dispatched at'],
      ...orders.map((o) => [
        o.number,
        o.createdAt,
        o.status,
        o.paymentMethod,
        o.paymentStatus,
        o.paidAt,
        o.name,
        o.email,
        o.phone,
        o.shipLine1,
        o.shipLine2,
        o.shipCity,
        o.shipPostcode,
        o.shipCountry,
        o.items.map((i) => `${i.qty} x ${i.productName} (${i.packLabel.split(' · ')[0]})${i.lotCodes ? ` lot ${i.lotCodes}` : ''}`).join('; '),
        o.items.reduce((n, i) => n + i.vials * i.qty, 0),
        pounds(o.subtotal),
        pounds(o.discount),
        o.discountCode,
        pounds(o.credit),
        pounds(o.shipping),
        o.shippingMethodName,
        pounds(o.total),
        pounds(o.refundedAmount),
        o.trackingNumber,
        o.dispatchedAt,
      ]),
    ]);
  }

  if (kind === 'customers') {
    const customers = await db.customer.findMany({ where: customersWhere(sp), orderBy: { createdAt: 'desc' }, take: MAX });
    const totals = await customerTotals(customers.map((c) => c.id));
    await logActivity(admin.id, 'export.customers', 'customer', undefined, `${customers.length} rows`);
    return csvResponse('customers', [
      ['Name', 'Email', 'Phone', 'Account', 'Marketing opt-in', 'Orders', 'Spent', 'Last order', 'Store credit', 'Tags', 'Referral code', 'Blocked', 'Joined'],
      ...customers.map((c) => {
        const t = totals.get(c.id);
        return [c.name, c.email, c.phone, c.passwordHash ? 'yes' : 'no', c.marketingOptIn ? 'yes' : 'no', t?.orders ?? 0, pounds(t?.spent ?? 0), t?.last ?? null, pounds(c.creditPence), c.tags, c.referralCode, c.blocked ? 'yes' : 'no', c.createdAt];
      }),
    ]);
  }

  if (kind === 'subscribers') {
    const status = String(sp.status ?? '');
    const q = String(sp.q ?? '').trim().toLowerCase();
    const subs = await db.subscriber.findMany({
      where: {
        ...(q ? { email: { contains: q } } : {}),
        ...(status === 'active' ? { unsubscribedAt: null } : status === 'unsubscribed' ? { unsubscribedAt: { not: null } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: MAX,
    });
    await logActivity(admin.id, 'export.subscribers', 'subscriber', undefined, `${subs.length} rows`);
    return csvResponse('subscribers', [['Email', 'Source', 'Joined', 'Unsubscribed'], ...subs.map((s) => [s.email, s.source, s.createdAt, s.unsubscribedAt])]);
  }

  if (kind === 'affiliates') {
    const status = String(sp.status ?? '');
    const q = String(sp.q ?? '').trim();
    const rows = await db.affiliate.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { code: { contains: q.toUpperCase() } }, { company: { contains: q } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: MAX,
    });
    const bal = await balances(rows.map((r) => r.id));
    await logActivity(admin.id, 'export.affiliates', 'affiliate', undefined, `${rows.length} rows`);
    return csvResponse('affiliates', [
      ['Name', 'Email', 'Phone', 'Company', 'Code', 'Status', 'Commission %', 'Customer discount %', 'Orders', 'Sales', 'Pending', 'Ready to pay', 'Paid', 'Website', 'Joined', 'Last signed in'],
      ...rows.map((a) => {
        const b = bal.get(a.id) ?? EMPTY_BALANCE;
        return [a.name, a.email, a.phone, a.company, a.code, a.status, a.commissionBps / 100, a.customerDiscountPct, b.sales, pounds(b.salesValue), pounds(b.pending), pounds(b.approved), pounds(b.paid), a.website, a.approvedAt ?? a.createdAt, a.lastLoginAt];
      }),
    ]);
  }

  if (kind === 'affiliate-payouts') {
    // Everyone with commission ready to pay, with bank details, for a bulk payment in online banking.
    if (!can(admin, 'affiliateEdit')) return new Response('Forbidden', { status: 403 });
    const bal = await balances();
    const due = [...bal].filter(([, b]) => b.approved > 0);
    const rows = await db.affiliate.findMany({ where: { id: { in: due.map(([id]) => id) } }, orderBy: { name: 'asc' } });
    await logActivity(admin.id, 'export.affiliate_payouts', 'affiliate', undefined, `${rows.length} rows with bank details`);
    const stamp = new Date().toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'Europe/London' }).replace(' ', '').toUpperCase();
    return csvResponse('affiliate-payouts', [
      ['Name', 'Email', 'Code', 'Amount', 'Account name', 'Sort code', 'Account number', 'IBAN', 'BIC', 'Reference', 'Bank details changed'],
      ...rows.map((a) => {
        const k = readBank(a);
        return [a.name, a.email, a.code, pounds(bal.get(a.id)?.approved ?? 0), k.accountName, k.sortCode, k.accountNumber, k.iban, k.bic, `${a.code} ${stamp}`.slice(0, 18), a.bankUpdatedAt];
      }),
    ]);
  }

  return new Response('Unknown export', { status: 404 });
}
