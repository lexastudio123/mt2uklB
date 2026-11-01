// Dispatch and delivery date estimates. Runs on the server and in the browser.
// Dates are handled as UK wall-clock time (Europe/London).

export type ShipMethod = {
  id: string;
  name: string;
  price: number; // pence
  note: string;
  min: number; // working days after dispatch
  max: number;
  freeOver: boolean; // counts towards the free delivery threshold
  active: boolean;
};

export type EtaConfig = {
  cutoffHour: number;
  closedDates: string[]; // YYYY-MM-DD, bank holidays and shutdowns
};

/** Current time as a Date whose local fields equal UK wall-clock time. */
export function ukNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function isWorkDay(d: Date, cfg: EtaConfig): boolean {
  const day = d.getDay();
  return day > 0 && day < 6 && !cfg.closedDates.includes(ymd(d));
}

function addWorkDays(d: Date, n: number, cfg: EtaConfig): Date {
  const x = new Date(d);
  let k = 0;
  while (k < n) {
    x.setDate(x.getDate() + 1);
    if (isWorkDay(x, cfg)) k++;
  }
  return x;
}

export function dispatchDay(cfg: EtaConfig, now: Date = ukNow()): { d: Date; today: boolean; ms: number } {
  const cut = new Date(now);
  cut.setHours(cfg.cutoffHour, 0, 0, 0);
  if (isWorkDay(now, cfg) && now < cut) return { d: now, today: true, ms: +cut - +now };
  const d = new Date(now);
  do d.setDate(d.getDate() + 1);
  while (!isWorkDay(d, cfg));
  return { d, today: false, ms: 0 };
}

/** Expected arrival window. Times are set to midday so the calendar day survives time zone shifts. */
export function arrival(cfg: EtaConfig, m: Pick<ShipMethod, 'min' | 'max'>, now?: Date): [Date, Date] {
  const dd = dispatchDay(cfg, now).d;
  const a = addWorkDays(dd, m.min, cfg);
  const b = addWorkDays(dd, m.max, cfg);
  a.setHours(12, 0, 0, 0);
  b.setHours(12, 0, 0, 0);
  return [a, b];
}

export const fday = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Sentence for the ETA line. Bold parts are wrapped in ** so callers can render them. */
export function etaParts(cfg: EtaConfig, m: ShipMethod): { lead: string; rest: string } {
  const dd = dispatchDay(cfg);
  const [a, b] = arrival(cfg, m);
  const lead = dd.today
    ? `Order within **${Math.floor(dd.ms / 36e5)} h ${Math.floor((dd.ms % 36e5) / 6e4)} min** for dispatch today`
    : `Order now for dispatch **${fday(dd.d)}**`;
  const rest = `${m.name} delivery arrives **${fday(a)}**${+a === +b ? '' : ` to **${fday(b)}**`}.`;
  return { lead, rest };
}

export function etaPlain(cfg: EtaConfig, m: ShipMethod): string {
  const { lead, rest } = etaParts(cfg, m);
  return `${lead}. ${rest}`.replace(/\*\*/g, '');
}

export function cutoffLabel(hour: number): string {
  const h = hour % 12 || 12;
  return `${h}${hour < 12 ? 'am' : 'pm'}`;
}
