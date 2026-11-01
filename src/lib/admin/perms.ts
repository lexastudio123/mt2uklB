import 'server-only';
import type { AdminUser } from '@prisma/client';
import { hasRole, requireAdmin, type AdminRole } from '../auth';

// Who can do what in the admin. Staff run day-to-day fulfilment and support;
// admins also manage the catalogue, money and settings; owners also manage the team.
export const AREA_MIN = {
  dashboard: 'staff',
  orders: 'staff',
  refunds: 'admin',
  customers: 'staff',
  customerEdit: 'admin',
  inbox: 'staff',
  products: 'staff',
  productEdit: 'admin',
  lots: 'staff',
  lotEdit: 'admin',
  discounts: 'admin',
  subscribers: 'admin',
  emails: 'admin',
  settings: 'admin',
  activity: 'admin',
  export: 'admin',
  team: 'owner',
} as const satisfies Record<string, AdminRole>;

export type Area = keyof typeof AREA_MIN;

export const can = (a: Pick<AdminUser, 'role'>, area: Area) => hasRole(a, AREA_MIN[area]);

/** Use at the top of each admin page and server action. */
export const requireArea = (area: Area) => requireAdmin(AREA_MIN[area]);

export const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', staff: 'Staff' };
