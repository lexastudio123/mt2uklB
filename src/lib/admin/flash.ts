import 'server-only';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { OrderError } from '../orders';

/** Redirect back to a page with a success (?ok=) or error (?err=) banner. Call outside try/catch. */
export function back(path: string, result: { ok?: string; err?: string }): never {
  const u = new URL(path, 'http://admin.local');
  u.searchParams.delete('ok');
  u.searchParams.delete('err');
  if (result.err) u.searchParams.set('err', result.err.slice(0, 300));
  else if (result.ok) u.searchParams.set('ok', result.ok.slice(0, 300));
  // Refresh sidebar counts held by the admin layout.
  revalidatePath('/admin', 'layout');
  redirect(u.pathname + u.search);
}

/** Turn an exception into a message that is safe and useful to show the team. */
export function errorMessage(e: unknown): string {
  if (e instanceof OrderError) return e.message;
  if (e instanceof ZodError) return e.issues[0]?.message || 'Check the form and try again.';
  if (e instanceof UserError) return e.message;
  if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') return 'That value is already used by another record.';
  console.error('[admin]', e);
  return 'Something went wrong. Nothing was changed. Try again, and check the server log if it keeps happening.';
}

/** Throw for problems the person can fix (shown as-is). */
export class UserError extends Error {}
