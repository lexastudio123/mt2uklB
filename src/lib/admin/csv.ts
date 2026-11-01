// CSV for spreadsheet exports. Text cells that start with a formula character are
// prefixed with an apostrophe so Excel and Sheets never run them as formulas.
type Cell = string | number | boolean | null | undefined | Date;

function cell(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function csvResponse(name: string, rows: Cell[][]): Response {
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const pounds = (pence: number) => (pence / 100).toFixed(2);
