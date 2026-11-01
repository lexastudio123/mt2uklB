import type { Metadata } from 'next';
import { LegalPage } from '@/components/shop/legal-page';

export const metadata: Metadata = { title: 'Cookies' };

export default function Page() {
  return <LegalPage kind="cookies" />;
}
