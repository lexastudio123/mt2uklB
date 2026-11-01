import type { Metadata } from 'next';
import { BasketView } from '@/components/shop/basket-view';

export const metadata: Metadata = { title: 'Your basket', robots: { index: false } };

export default function BasketPage() {
  return <BasketView />;
}
