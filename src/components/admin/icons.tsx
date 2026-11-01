// Admin navigation icons (1.7px line icons to match the shop set).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const s = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const PATHS: Record<string, React.ReactNode> = {
  dashboard: (<><rect x="3.5" y="3.5" width="7" height="8" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.2" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.2" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.2" /></>),
  orders: (<><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>),
  customers: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.6 3.6-5.5 6.5-5.5s5.5 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.4.8 2.4 2.5 3 5.2" /></>),
  inbox: (<><path d="M3.5 13.5 6 5h12l2.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19v-5.5Z" /><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5" /></>),
  products: (<><path d="M9 3h6M10 3v4.5l-4.6 9.2A2.5 2.5 0 0 0 7.6 20.5h8.8a2.5 2.5 0 0 0 2.2-3.8L14 7.5V3" /><path d="M7.5 14h9" /></>),
  lots: (<><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>),
  discounts: (<><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0l-8.3-8.3Z" /><circle cx="8" cy="8" r="1.4" /></>),
  affiliates: (<><path d="M9.5 14.5 7 17a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" /><path d="M14.5 9.5 17 7a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" /><path d="m9 15 6-6" /></>),
  subscribers: (<><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="m3.5 6 8.5 7 8.5-7" /></>),
  emails: (<><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9.5h8M8 12.5h5" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>),
  team: (<><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  activity: (<><path d="M3 12h4l3-8 4 16 3-8h4" /></>),
  account: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
  menu: (<path d="M4 7h16M4 12h16M4 17h16" />),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  tick: (<path d="m5 12 4.5 4.5L19 7" />),
  alert: (<><path d="M12 8v5" /><path d="M12 16.5v.01" /><circle cx="12" cy="12" r="9" /></>),
  external: (<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>),
};

export function AdminIcon({ name, ...p }: P & { name: string }) {
  return <svg {...s} {...p}>{PATHS[name] ?? PATHS.dashboard}</svg>;
}
