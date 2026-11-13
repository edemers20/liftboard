import { engine } from "@/store";

/** First open after the open week ends saves that week and starts the next one. */
export function rollWeekIfDue(): boolean {
  if (!engine.wk.setupDone) return false;
  const now = Date.now();
  if (!engine.wk.weekStart) {
    engine.wk.weekStart = engine.weekStartOf(now).getTime();
    engine.save();
    return false;
  }
  const open = engine.weekStartOf(engine.wk.weekStart);
  const next = new Date(open.getTime());
  next.setDate(next.getDate() + 7);
  if (now < next.getTime()) return false;
  engine.newWeek(Math.max(next.getTime(), engine.weekStartOf(now).getTime()));
  return true;
}
