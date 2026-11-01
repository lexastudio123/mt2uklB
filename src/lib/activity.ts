import 'server-only';
import { headers } from 'next/headers';
import { db } from './db';
import { clientIp } from './security';

/** Audit trail of admin actions (Admin › Activity). */
export async function logActivity(adminId: string | null, action: string, entity?: string, entityId?: string, detail?: string) {
  let ip: string | null = null;
  try {
    ip = clientIp(await headers());
  } catch {}
  await db.activityLog.create({ data: { adminId, action, entity: entity ?? null, entityId: entityId ?? null, detail: detail?.slice(0, 1000) ?? null, ip } });
}
