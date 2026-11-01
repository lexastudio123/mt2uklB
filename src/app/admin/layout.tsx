import type { Metadata } from 'next';
import '@/styles/admin.css';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · MT2 Lab admin' },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>;
}
