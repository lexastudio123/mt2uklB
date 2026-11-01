import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { can, ROLE_LABEL, type Area } from '@/lib/admin/perms';
import { AdminChrome, type NavItem } from '@/components/admin/chrome';
import { adminLogout } from './actions';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin('staff');
  const [awaiting, toPack, openTickets, applications] = await Promise.all([
    db.order.count({ where: { status: 'awaiting_payment' } }),
    db.order.count({ where: { status: { in: ['paid', 'packed'] } } }),
    db.ticket.count({ where: { status: 'open' } }),
    db.affiliate.count({ where: { status: 'pending' } }),
  ]);
  const all: (NavItem & { area: Area })[] = [
    { href: '/admin', label: 'Dashboard', icon: 'dashboard', area: 'dashboard' },
    { href: '/admin/orders', label: 'Orders', icon: 'orders', area: 'orders', count: toPack || awaiting, soft: !toPack },
    { href: '/admin/customers', label: 'Customers', icon: 'customers', area: 'customers' },
    { href: '/admin/inbox', label: 'Inbox', icon: 'inbox', area: 'inbox', count: openTickets },
    { href: '/admin/products', label: 'Products', icon: 'products', area: 'products', section: 'Catalogue' },
    { href: '/admin/lots', label: 'Lot reports', icon: 'lots', area: 'lots', section: 'Catalogue' },
    { href: '/admin/discounts', label: 'Discounts', icon: 'discounts', area: 'discounts', section: 'Catalogue' },
    { href: '/admin/affiliates', label: 'Affiliates', icon: 'affiliates', area: 'affiliates', count: applications, section: 'Marketing' },
    { href: '/admin/subscribers', label: 'Subscribers', icon: 'subscribers', area: 'subscribers', section: 'Marketing' },
    { href: '/admin/emails', label: 'Emails', icon: 'emails', area: 'emails', section: 'Marketing' },
    { href: '/admin/settings', label: 'Settings', icon: 'settings', area: 'settings', section: 'Store' },
    { href: '/admin/team', label: 'Team', icon: 'team', area: 'team', section: 'Store' },
    { href: '/admin/activity', label: 'Activity', icon: 'activity', area: 'activity', section: 'Store' },
  ];
  const items = all.filter((i) => can(admin, i.area)).map(({ area: _a, ...rest }) => rest);
  return (
    <AdminChrome items={items} admin={{ name: admin.name, email: admin.email, role: ROLE_LABEL[admin.role] ?? admin.role }} logout={adminLogout}>
      {children}
    </AdminChrome>
  );
}
