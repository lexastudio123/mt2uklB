import type { Metadata } from 'next';
import { LegalPage } from '@/components/shop/legal-page';

export const metadata: Metadata = { title: 'Privacy notice' };

export default function Page() {
  return <LegalPage kind="privacy" />;
}
