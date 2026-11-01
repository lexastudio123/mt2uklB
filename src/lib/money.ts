// All amounts are integer pence. These helpers match the design's formatting:
// `money` drops ".00" on whole pounds, `m2` always shows two decimals.

export function fmt(pence: number, dec?: number): string {
  const v = pence / 100;
  const d = dec ?? (Math.abs(v - Math.round(v)) > 0.004 ? 2 : 0);
  const s = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: 2 });
  return (v < 0 ? '−£' : '£') + s;
}

export const money = (pence: number) => fmt(pence);
export const m2 = (pence: number) => fmt(pence, 2);

/** Parse "12.50", "£12.5" or "12" into pence. Returns NaN when it is not a number. */
export function toPence(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100);
  const n = Number(String(input).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Pence to a plain "12.50" string for form inputs. */
export const toPounds = (pence: number) => (pence / 100).toFixed(2);
