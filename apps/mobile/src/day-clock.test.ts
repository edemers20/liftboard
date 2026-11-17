import assert from "node:assert/strict";

import * as engine from "@liftboard/engine";

import { nextDayStart, rollWeek, startDayClock, type ClockDeps } from "./day-clock.ts";

/** A clock that only moves when the test moves it. */
function fakeClock(start: number) {
  let time = start;
  let queue: { at: number; run: () => void; id: number }[] = [];
  let ids = 0;
  const deps: ClockDeps = {
    now: () => time,
    setTimeout: (run, ms) => {
      const id = ++ids;
      queue.push({ at: time + ms, run, id });
      return id;
    },
    clearTimeout: (handle) => {
      queue = queue.filter((item) => item.id !== handle);
    },
  };
  return {
    deps,
    /** Runs every timer due by `to`, in order. */
    advanceTo(to: number) {
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        const next = queue[0];
        if (!next || next.at > to) break;
        queue.shift();
        time = next.at;
        next.run();
      }
      time = to;
    },
    /** The device slept: time moves on and no timer fires. */
    jumpTo(to: number) {
      time = to;
    },
    pending: () => queue.length,
  };
}

const memory = new Map<string, string>();
engine.init({ getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value) });

let version = 0;
engine.setSaveHook(() => {
  version++;
});

const monday = new Date(2026, 10, 9).getTime();
const sundayNight = new Date(2026, 10, 15, 23, 59).getTime();
const nextMonday = new Date(2026, 10, 16).getTime();
Object.assign(engine.wk, { setupDone: true, wkStart: "Mon", weekStart: monday, mig1: 1, mig2: 1, mig3: 1, mig4: 1, mig5: 1, mig6: 1 });
engine.syncDays();

assert.equal(nextDayStart(sundayNight), nextMonday, "next day starts at local midnight");

const clock = fakeClock(sundayNight);
let days = 0;
const day = startDayClock(() => {
  days++;
  rollWeek(engine, clock.deps.now());
  version++;
}, clock.deps);

clock.advanceTo(sundayNight + 30 * 1000);
assert.equal(days, 0, "nothing happens before midnight");
assert.equal(engine.wk.weekStart, monday, "the open week stays open before midnight");
const before = version;

clock.advanceTo(nextMonday + 5 * 1000);
assert.equal(days, 1, "midnight fires once, with the app open");
assert.equal(engine.wk.weekStart, nextMonday, "the new week starts at Monday midnight");
assert.ok(engine.pendingWeekReport(), "last week's report is waiting");
assert.ok(version > before, "the store version moved, so every subscribed tab redraws");
assert.ok(clock.pending() === 1, "the clock re-arms for the next day");

clock.advanceTo(nextMonday + 23 * 36e5);
assert.equal(days, 1, "no second call on the same day");

const wednesday = new Date(2026, 10, 18, 9).getTime();
clock.jumpTo(wednesday);
day.check();
assert.equal(days, 2, "on resume after sleeping, one call for the new date");
assert.equal(engine.wk.weekStart, nextMonday, "midweek resume doesn't roll the week");

const weekLater = new Date(2026, 10, 24, 8).getTime();
clock.jumpTo(weekLater);
day.check();
assert.equal(engine.wk.weekStart, new Date(2026, 10, 23).getTime(), "resume a week later rolls to the current week");

day.stop();
assert.equal(clock.pending(), 0, "stop clears the timer");

console.log("day-clock ok");
