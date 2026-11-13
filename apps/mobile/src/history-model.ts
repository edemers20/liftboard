/** Pure history math. Mirrors the avg week breakdown, calendar and sparkline in src/main.js. */

export type MixKind = "lift" | "sport" | "cls" | "cardio";

export const MIX_ORDER: MixKind[] = ["lift", "sport", "cls", "cardio"];

export type MixInput = {
  t: number;
  kind: MixKind;
  minutes: number;
};

export type MixWeek = {
  start: number;
  current: boolean;
  total: number;
  minutes: Record<MixKind, number>;
};

export type WeekMix = {
  weeks: MixWeek[];
  max: number;
  averageMinutes: number;
};

export type MonthCell = { day: number; key: string } | null;

const LB_PER_KG = 2.20462;

export function dayKey(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Monday-first month. `monthIndex` is 0-based, matching Date. */
export function monthGrid(year: number, monthIndex: number): { lead: number; days: number; cells: MonthCell[] } {
  const lead = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: MonthCell[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) cells.push({ day, key: `${year}-${monthIndex}-${day}` });
  return { lead, days, cells };
}

/** Week boundary already passed, so the open week should be saved. Null when it is still this week. */
export function dueWeekStart(saved: number | undefined, now: number, wkStart: string | undefined): number | null {
  const start = weekStart(now, wkStart);
  if (!saved || saved >= start) return null;
  return start;
}

export function weekStart(time: number, wkStart: string | undefined): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  const back = wkStart === "Sun" ? date.getDay() : (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - back);
  return date.getTime();
}

function addDays(time: number, days: number): number {
  const date = new Date(time);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** "½h", "1½h", "7h", "10h". Hours of 10 or more round to a whole number. */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)}h`;
  const half = Math.round(hours * 2) / 2;
  const text = String(half).replace(/\.5$/, "½").replace(/^0½$/, "½");
  return `${text}h`;
}

export function displayWeight(lb: number, units: string | undefined): number {
  if (units !== "kg") return +lb;
  return Math.round((+lb / LB_PER_KG) * 10) / 10;
}

export function formatWeight(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** Est. 1RM points in a 96×44 sparkline. A flat series sits on the baseline. */
export function linePoints(values: number[]): { x: number; y: number }[] {
  const count = values.length;
  if (!count) return [];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(1, high - low);
  return values.map((value, index) => ({
    x: +(count > 1 ? 4 + (index * 88) / (count - 1) : 48).toFixed(1),
    y: +(40 - ((value - low) / span) * 34).toFixed(1),
  }));
}

/** "Nov 2 – 8", or "Oct 26 – Nov 1" when the week crosses a month. */
export function weekRange(start: number): string {
  const open = new Date(start);
  const close = new Date(start);
  close.setDate(close.getDate() + 6);
  const left = open.toLocaleDateString("en-US", { month: "short" });
  const right = close.toLocaleDateString("en-US", { month: "short" });
  if (open.getMonth() === close.getMonth() && open.getFullYear() === close.getFullYear()) {
    return `${left} ${open.getDate()} – ${close.getDate()}`;
  }
  return `${left} ${open.getDate()} – ${right} ${close.getDate()}`;
}

/** Last 8 top-set weights, plotted in a 112×32 box. */
export function sparkPoints(weights: number[]): { x: number; y: number }[] {
  const recent = weights.slice(-8);
  const count = recent.length;
  if (!count) return [];
  const low = Math.min(...recent);
  const high = Math.max(...recent);
  return recent.map((weight, index) => ({
    x: +(count > 1 ? 4 + (index * 104) / (count - 1) : 56).toFixed(1),
    y: +(high === low ? 16 : 28 - ((weight - low) / (high - low)) * 24).toFixed(1),
  }));
}

/** Last 8 weeks, from the first logged session through the current week. */
export function buildWeekMix(items: MixInput[], now: number, wkStart: string | undefined): WeekMix {
  const sorted = items.slice().sort((a, b) => a.t - b.t);
  const current = weekStart(now, wkStart);
  const first = sorted.length ? weekStart(sorted[0].t, wkStart) : current;
  const count = Math.max(1, Math.min(8, Math.round((current - first) / 604800000) + 1));
  const weeks: MixWeek[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = addDays(current, -7 * (count - 1 - index));
    const end = addDays(start, 7);
    const minutes: Record<MixKind, number> = { lift: 0, sport: 0, cls: 0, cardio: 0 };
    for (const item of sorted) {
      if (item.t >= start && item.t < end) minutes[item.kind] += item.minutes;
    }
    const total = minutes.lift + minutes.sport + minutes.cls + minutes.cardio;
    weeks.push({ start, current: index === count - 1, total, minutes });
  }
  const done = weeks.slice(0, -1).filter((week) => week.total > 0);
  const averageMinutes = done.length ? done.reduce((sum, week) => sum + week.total, 0) / done.length : 0;
  return { weeks, max: Math.max(60, ...weeks.map((week) => week.total)), averageMinutes };
}
