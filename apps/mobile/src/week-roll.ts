import { rollWeek } from "@/day-clock";
import { engine, useEngineStore } from "@/store";

/** First open after the open week ends saves that week and starts the next one. */
export function rollWeekIfDue(): boolean {
  return rollWeek(engine, Date.now());
}

/** New day while the app is open: roll the week if it's due, and redraw every screen for the new date. */
export function onNewDay() {
  rollWeekIfDue();
  useEngineStore.setState((state) => ({ version: state.version + 1 }));
}
