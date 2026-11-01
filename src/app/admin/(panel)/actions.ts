'use server';

import { redirect } from 'next/navigation';
import { endAdminSession, getAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function adminLogout(): Promise<void> {
  const a = await getAdmin();
  if (a) await logActivity(a.id, 'admin.logout', 'admin', a.id, 'Signed out');
  await endAdminSession();
  redirect('/admin/login');
}
