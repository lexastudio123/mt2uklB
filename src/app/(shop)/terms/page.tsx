import type { Metadata } from 'next';
import { LegalPage } from '@/components/shop/legal-page';

export const metadata: Metadata = {
  title: 'Terms and conditions',
  description: 'The terms for buying from MT2 Lab: who can order, research use only, orders, prices and payment, delivery, returns and liability.',
  alternates: { canonical: '/terms' },
};

export default function Page() {
  return <LegalPage kind="terms" />;
}
