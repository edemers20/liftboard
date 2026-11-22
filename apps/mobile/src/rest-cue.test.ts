import assert from "node:assert/strict";

import * as engine from "@liftboard/engine";

import { peekRest, REST_CUE_WINDOW_MS, restCueDue, restCueWait } from "./workout/rest-cue.ts";

const end = Date.UTC(2026, 10, 22, 16);

// The cue plays once, at the end, with the app open.
assert.equal(restCueDue(end, end - 1, true, 0), false, "not before the end");
assert.equal(restCueDue(end, end, true, 0), true, "at the end");
assert.equal(restCueDue(end, end + 30, true, 0), true, "the watcher wakes 30 ms late");
assert.equal(restCueDue(end, end + 30, true, end), false, "only once per rest");
assert.equal(restCueDue(end, end + 30, false, 0), false, "never in the background; the lock screen alert covers it");
assert.equal(restCueDue(0, end, true, 0), false, "no rest");
assert.equal(restCueDue(Number.NaN, end, true, 0), false, "broken rest");

// Leaving the app mid-rest and coming back before the end no longer mutes the cue.
// The rule only looks at the end time and whether the app is open now.
assert.equal(restCueDue(end, end + 10, true, 0), true, "back in the app before the end, then it ends");

// A rest that ended while the app was away stays quiet on return (same 3 s window as the web).
assert.equal(restCueDue(end, end + REST_CUE_WINDOW_MS, true, 0), true);
assert.equal(restCueDue(end, end + REST_CUE_WINDOW_MS + 1, true, 0), false, "ended while away");

// The watcher waits until just past the end, and not at all once it has passed.
assert.equal(restCueWait(end, end - 90_000), 90_030);
assert.equal(restCueWait(end, end), null);
assert.equal(restCueWait(0, end), null);

// Rest view: counting, Go at zero, gone 5 minutes after.
assert.deepEqual(peekRest({ end, why: "" }, end - 59_600), { over: false, seconds: 60, why: "", end });
assert.deepEqual(peekRest({ end }, end + 1000), { over: true, seconds: 0, why: "", end });
assert.equal(peekRest({ end }, end + 301_000), null);
assert.equal(peekRest(null, end), null);

// Ticking the next set while the bar shows Done replaces it with a new countdown.
const memory = new Map<string, string>();
engine.init({
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
});
Object.assign(engine.wk, { setupDone: true, onbDone: true, focus: "Lower", days: 3 });
engine.syncDays();
const day = engine.DAYS[0];
const first = (engine.slotOrder(day) as number[]).find((index) => !day.slots[index].cardio)!;
engine.beginRest(day.id, first, 0);
engine.wk.rest.end = Date.now() - 1000;
assert.equal(peekRest(engine.wk.rest, Date.now())?.over, true, "first rest is in Go");
const started = engine.beginRest(day.id, first, 1);
const view = peekRest(engine.wk.rest, Date.now());
assert.ok(started && view, "the second set starts a rest");
assert.equal(view.over, false, "the bar counts down again");
assert.equal(view.end, started.end);

console.log("rest-cue ok");
