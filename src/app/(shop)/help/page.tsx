import type { Metadata } from 'next';
import { getCatalog, toClientProduct } from '@/lib/catalog';
import { bankTransferAvailable, cardPaymentsAvailable, getSettings } from '@/lib/settings';
import { helpContent } from '@/content/help';
import { HelpCentre } from './client';

export const metadata: Metadata = { title: 'Help centre', description: 'Answers about ordering, delivery, returns, payments, products and accounts.' };

export default async function HelpPage() {
  const [catalog, s] = await Promise.all([getCatalog(), getSettings()]);
  const cats = helpContent(catalog.map(toClientProduct), s, { card: cardPaymentsAvailable(s), bank: bankTransferAvailable(s) });
  return <HelpCentre cats={cats} />;
}
