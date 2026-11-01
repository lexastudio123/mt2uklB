import type { Metadata } from 'next';
import { LegalPage } from '@/components/shop/legal-page';

export const metadata: Metadata = {
  title: 'Cookies',
  description: 'MT2 Lab uses only the cookies and storage the shop needs to work: your basket, your sign in and the research use notice. No tracking.',
  alternates: { canonical: '/cookies' },
};

export default function Page() {
  return <LegalPage kind="cookies" />;
}
