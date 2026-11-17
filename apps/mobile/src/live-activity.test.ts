import assert from "node:assert/strict";

import * as engine from "@liftboard/engine";

import { activityKey, activityProps } from "./live-activity/state.ts";

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
const id: string = day.id;
const plan = engine.plan().days[id];
const first = (engine.slotOrder(day) as number[]).find((index) => !day.slots[index].cardio)!;
const sets = plan.slots[first].sets as number;
const now = Date.UTC(2026, 10, 17, 18);

engine.wk.wt = { [id]: { start: now - 60e3 } };
let props = activityProps(id, now)!;
assert.equal(props.title, day.title);
assert.equal(props.exercise, engine.exName(day, day.slots[first], first));
assert.equal(props.setLine, `Set 1 of ${sets}`);
assert.equal(props.setsDone, 0);
assert.ok(props.setsTotal >= sets);
assert.equal(props.restEnd, 0);
assert.equal(props.finished, false);
assert.equal(props.goLabel, "Go");

// A ticked set and a rest: the countdown runs to the rest end, and the next set shows.
engine.set(id, first, "log", [{ w: "95", r: "8", d: true }]);
engine.wk.rest = { end: now + 90e3, name: props.exercise };
const before = activityKey(props);
props = activityProps(id, now)!;
assert.equal(props.setsDone, 1);
assert.equal(props.setLine, `Set 2 of ${sets}`);
assert.equal(props.restEnd, now + 90e3);
assert.equal(props.restStart, now);
assert.notEqual(activityKey(props), before);
// Reading again a second later doesn't count as a change.
assert.equal(activityKey(activityProps(id, now + 1000)), activityKey(props));

// Rest over: no countdown.
assert.equal(activityProps(id, now + 120e3)!.restEnd, 0);

// Day done.
engine.wk.done = { [id]: true };
props = activityProps(id, now)!;
assert.equal(props.finished, true);
assert.equal(props.restEnd, 0);
assert.equal(props.doneLabel, "✓ Day done");

console.log("live activity ok");
