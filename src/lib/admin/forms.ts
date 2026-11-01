// Small FormData readers for admin server actions.
import { toPence } from '../money';
import { UserError } from './flash';

export const str = (fd: FormData, k: string, max = 5000) => String(fd.get(k) ?? '').trim().slice(0, max);
export const optStr = (fd: FormData, k: string, max = 5000) => str(fd, k, max) || null;
export const bool = (fd: FormData, k: string) => ['on', 'true', '1', 'yes'].includes(String(fd.get(k) ?? ''));
export const ids = (fd: FormData, k: string) => fd.getAll(k).map(String).filter(Boolean);

export function int(fd: FormData, k: string, opts: { min?: number; max?: number; label?: string; optional?: boolean } = {}): number {
  const raw = str(fd, k);
  if (!raw && opts.optional) return NaN;
  const n = Number(raw);
  const label = opts.label ?? k;
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new UserError(`${label} must be a whole number.`);
  if (opts.min !== undefined && n < opts.min) throw new UserError(`${label} must be at least ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw new UserError(`${label} must be at most ${opts.max}.`);
  return n;
}

/** Pounds typed by a person ("12.50", "£12") to pence. */
export function pounds(fd: FormData, k: string, opts: { min?: number; label?: string; optional?: boolean } = {}): number {
  const raw = str(fd, k);
  const label = opts.label ?? k;
  if (!raw && opts.optional) return NaN;
  const p = toPence(raw);
  if (!Number.isFinite(p)) throw new UserError(`${label} must be an amount in pounds, like 12.50.`);
  if (opts.min !== undefined && p < opts.min) throw new UserError(`${label} must be at least £${(opts.min / 100).toFixed(2)}.`);
  return p;
}

/** "2026-11-03" from a date input to a Date at UK midday (keeps the calendar day across time zones). */
export function dateOnly(fd: FormData, k: string): Date | null {
  const raw = str(fd, k);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new UserError('Dates must look like 2026-11-03.');
  const d = new Date(raw + 'T12:00:00Z');
  if (Number.isNaN(+d)) throw new UserError('That date is not valid.');
  return d;
}

/** Date to "YYYY-MM-DD" for date inputs (UK calendar day). */
export const toDateInput = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }) : '');

export const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
