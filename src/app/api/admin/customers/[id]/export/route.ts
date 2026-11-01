import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { can } from '@/lib/admin/perms';

/** Subject access request: everything held about one customer, as JSON. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin || !can(admin, 'customerEdit')) return new Response('Forbidden', { status: 403 });
  const { id } = await params;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      addresses: true,
      orders: { include: { items: true, events: { select: { type: true, message: true, createdAt: true } } }, orderBy: { createdAt: 'asc' } },
      tickets: { include: { messages: { select: { author: true, body: true, createdAt: true } } } },
      alerts: { include: { product: { select: { name: true } } } },
      credits: true,
      notes: { select: { body: true, createdAt: true } },
      chats: { select: { messages: true, createdAt: true } },
    },
  });
  if (!c) return new Response('Not found', { status: 404 });
  const [subscriber, emails] = await Promise.all([
    db.subscriber.findUnique({ where: { email: c.email }, select: { email: true, source: true, createdAt: true, unsubscribedAt: true } }),
    db.emailLog.findMany({ where: { to: c.email }, select: { subject: true, template: true, status: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  const { passwordHash, ...profile } = c;
  const data = {
    exportedAt: new Date().toISOString(),
    profile: { ...profile, hasPassword: !!passwordHash, addresses: undefined, orders: undefined, tickets: undefined, alerts: undefined, credits: undefined, notes: undefined, chats: undefined },
    addresses: c.addresses,
    orders: c.orders.map(({ ip, userAgent, accessToken, ...o }) => ({ ...o, ip, userAgent })),
    supportConversations: c.tickets.map(({ accessToken, ...t }) => t),
    productAlerts: c.alerts.map((a) => ({ product: a.product.name, createdAt: a.createdAt })),
    storeCredit: c.credits,
    staffNotes: c.notes,
    chatTranscripts: c.chats.map((ch) => {
      try {
        return { createdAt: ch.createdAt, messages: JSON.parse(ch.messages) };
      } catch {
        return { createdAt: ch.createdAt, messages: [] };
      }
    }),
    newsletter: subscriber,
    emailsSent: emails,
  };
  await logActivity(admin.id, 'customer.export', 'customer', c.id, c.email);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="customer-${c.id}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
