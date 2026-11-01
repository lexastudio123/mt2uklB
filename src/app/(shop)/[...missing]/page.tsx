import { notFound } from 'next/navigation';

// Unknown shop URLs render the shop's own 404 inside the site layout.
export default function Missing() {
  notFound();
}
