/** Timers the day clock uses. Tests pass a fake clock. */
export type ClockDeps = {
  now(): number;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

const HOUR = 36e5;

const realClock: ClockDeps = {
  now: () => Date.now(),
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function dayKey(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Local midnight after `time`. */
export function nextDayStart(time: number): number {
  const date = new Date(time);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

/**
 * Calls `onDay` once each time the local date changes while the app is open.
 * Wakes just after midnight, and at least hourly in case the device slept or the clock moved.
 * `check` runs the same test on demand, for when the app comes back to the foreground.
 */
export function startDayClock(onDay: () => void, deps: ClockDeps = realClock): { check(): void; stop(): void } {
  let seen = dayKey(deps.now());
  let handle: unknown = null;
  let stopped = false;

  function check() {
    const key = dayKey(deps.now());
    if (key === seen) return;
    seen = key;
    onDay();
  }

  function arm() {
    if (stopped) return;
    const wait = Math.min(HOUR, Math.max(1000, nextDayStart(deps.now()) - deps.now() + 1000));
    handle = deps.setTimeout(() => {
      check();
      arm();
    }, wait);
  }

  arm();
  return {
    check,
    stop() {
      stopped = true;
      if (handle != null) deps.clearTimeout(handle);
    },
  };
}

type WeekApi = {
  wk: { setupDone?: unknown; weekStart?: number };
  weekStartOf(time: number): Date;
  newWeek(start: number): unknown;
  save(): void;
};

/** First open after the open week ends saves that week and starts the next one. */
export function rollWeek(api: WeekApi, now: number): boolean {
  if (!api.wk.setupDone) return false;
  if (!api.wk.weekStart) {
    api.wk.weekStart = api.weekStartOf(now).getTime();
    api.save();
    return false;
  }
  const next = new Date(api.weekStartOf(api.wk.weekStart).getTime());
  next.setDate(next.getDate() + 7);
  if (now < next.getTime()) return false;
  api.newWeek(Math.max(next.getTime(), api.weekStartOf(now).getTime()));
  return true;
}
