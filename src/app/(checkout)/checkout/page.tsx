import type { Metadata } from 'next';
import { getCustomer } from '@/lib/auth';
import { db } from '@/lib/db';
import { Checkout } from '@/components/shop/checkout';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const customer = await getCustomer();
  const addresses = customer
    ? await db.address.findMany({ where: { customerId: customer.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }], take: 6 })
    : [];
  return (
    <Checkout
      profile={
        customer
          ? {
              email: customer.email,
              name: customer.name,
              phone: customer.phone ?? '',
              credit: customer.creditPence,
              addresses: addresses.map((a) => ({ id: a.id, name: a.name, line1: a.line1, line2: a.line2 ?? '', city: a.city, postcode: a.postcode, country: a.country, phone: a.phone ?? '' })),
            }
          : null
      }
    />
  );
}
