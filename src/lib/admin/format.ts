// Formatting helpers for admin pages (UK time).
const TZ = 'Europe/London';

export const fdt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '·';

export const fd = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '·';

export const ftime = (d: Date | string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

/** "5 min ago", "3 h ago", "Yesterday 14:02", else the date. */
export function ago(d: Date | string | null | undefined): string {
  if (!d) return '·';
  const t = new Date(d);
  const s = (Date.now() - +t) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400 && dayKey(t) === dayKey(new Date())) return `${Math.floor(s / 3600)} h ago`;
  const y = new Date(Date.now() - 864e5);
  if (dayKey(t) === dayKey(y)) return `Yesterday ${ftime(t)}`;
  return fd(t);
}

/** UK calendar day as YYYY-MM-DD. */
export const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });

export const ORDER_TONE: Record<string, string> = {
  awaiting_payment: 'amber',
  paid: 'blue',
  packed: 'violet',
  dispatched: 'teal',
  delivered: 'green',
  cancelled: '',
  refunded: 'red',
};

export const PAYMENT_LABEL: Record<string, string> = { bank_transfer: 'Bank transfer', card: 'Card', credit: 'Store credit' };
export const PAYMENT_STATUS_LABEL: Record<string, string> = { unpaid: 'Unpaid', paid: 'Paid', partially_refunded: 'Part refunded', refunded: 'Refunded' };
export const PAYMENT_TONE: Record<string, string> = { unpaid: 'amber', paid: 'green', partially_refunded: 'red', refunded: 'red' };

export const AFFILIATE_TONE: Record<string, string> = { pending: 'copper', active: 'green', paused: 'amber', rejected: '' };
export const COMMISSION_TONE: Record<string, string> = { pending: 'amber', approved: 'blue', paid: 'green', void: '' };

export const TICKET_LABEL: Record<string, string> = { open: 'Open', pending: 'Waiting on customer', closed: 'Closed' };
export const TICKET_TONE: Record<string, string> = { open: 'copper', pending: 'amber', closed: '' };

export const EVENT_LABEL: Record<string, string> = {
  created: 'Order placed',
  status: 'Status',
  payment: 'Payment',
  note: 'Note',
  email: 'Email',
  tracking: 'Dispatch',
  refund: 'Refund',
  system: 'System',
};

/** Compact pounds for chart axes: £0, £150, £1.2K */
export function compactPounds(pence: number): string {
  const v = pence / 100;
  if (v >= 1000) return `£${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `£${Math.round(v)}`;
}

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export const ORDER_LABEL: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid · to pack',
  packed: 'Packed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const TEMPLATE_LABEL: Record<string, string> = {
  order_received_bank: 'Order received, bank details',
  order_confirmed: 'Order confirmation',
  order_dispatched: 'Dispatch',
  order_cancelled: 'Cancellation',
  order_refunded: 'Refund',
  password_reset: 'Password reset',
  magic_link: 'Sign in link',
  claim_account: 'Finish account',
  welcome: 'Welcome',
  welcome_code: 'Welcome code',
  ticket_received: 'Message received',
  ticket_reply: 'Team reply',
  lot_alert: 'New lot alert',
  team_new_order: 'Team: new order',
  team_new_ticket: 'Team: new message',
  team_ticket_reply: 'Team: customer reply',
  affiliate_applied: 'Affiliate: application received',
  affiliate_exists: 'Affiliate: already registered',
  affiliate_invite: 'Affiliate: welcome and password',
  affiliate_reset: 'Affiliate: password reset',
  affiliate_rejected: 'Affiliate: application declined',
  affiliate_sale: 'Affiliate: new sale',
  affiliate_payout: 'Affiliate: payout sent',
  affiliate_bank_changed: 'Affiliate: bank details changed',
  team_affiliate_application: 'Team: affiliate application',
  team_affiliate_bank_changed: 'Team: affiliate bank change',
  team_test_email: 'Team: test email',
  team_connection_changed: 'Team: connection details changed',
};
