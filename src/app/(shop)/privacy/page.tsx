import type { Metadata } from 'next';
import { LegalPage } from '@/components/shop/legal-page';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'How MT2 Lab collects, uses, shares and keeps your personal data, and the rights you have over it under UK data protection law.',
  alternates: { canonical: '/privacy' },
};

export default function Page() {
  return <LegalPage kind="privacy" />;
}
