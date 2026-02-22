/**
 * All app date logic uses Eastern Time (America/New_York — EST/EDT).
 */

const TZ = 'America/New_York';

function formatInEST(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

/** Current date in EST as YYYY-MM-DD (for sync_date / filters). */
export function todayEST(): string {
  return formatInEST(new Date());
}

/** Add days to an EST date string (YYYY-MM-DD), return YYYY-MM-DD in EST. */
export function addDaysEST(estDateStr: string, deltaDays: number): string {
  const [y, m, d] = estDateStr.split('-').map(Number);
  const noonEST = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  const result = new Date(noonEST.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return formatInEST(result);
}

/** Current weekday in EST (0 = Sunday, 6 = Saturday). */
function weekdayEST(): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date());
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

/** This week Sunday–Saturday in EST. Returns [start, end] as YYYY-MM-DD. */
export function getWeekRangeEST(): [string, string] {
  const today = todayEST();
  const day = weekdayEST();
  const sun = addDaysEST(today, -day);
  const sat = addDaysEST(sun, 6);
  return [sun, sat];
}

/** Monday of the week containing the given EST date (YYYY-MM-DD). Returns YYYY-MM-DD. */
export function getMondayOfWeekEST(estDateStr: string): string {
  const [y, m, d] = estDateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d, 17, 0, 0)).getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  return addDaysEST(estDateStr, -daysFromMonday);
}

/** This month 1st–last day in EST. Returns [start, end] as YYYY-MM-DD. */
export function getMonthRangeEST(): [string, string] {
  const t = todayEST();
  const [y, m] = t.split('-');
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return [`${y}-${m}-01`, `${y}-${m}-${String(lastDay).padStart(2, '0')}`];
}

/** Date only in EST as YYYY-MM-DD (for a given Date or ISO string). */
export function dateOnlyEST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInEST(d);
}

/** Format a date (Date or ISO string) for display in EST. */
export function formatDateEST(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: TZ }).format(d);
}

/** Format for long date (e.g. "February 22, 2026") in EST. */
export function formatLongEST(date?: Date | string | null): string {
  if (date == null) return '—';
  return formatDateEST(date, { dateStyle: 'long' });
}

/** Format for short range (e.g. "Feb 16 – Feb 22, 2026") in EST. */
export function formatRangeShortEST(start: string, end: string): string {
  const s = formatDateEST(start, { month: 'short', day: 'numeric', year: 'numeric' });
  const e = formatDateEST(end, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

/** ISO string for "now" in EST (for paid_at, etc.). Stored as UTC in DB; use when you need a timestamp. */
export function nowISO(): string {
  return new Date().toISOString();
}
