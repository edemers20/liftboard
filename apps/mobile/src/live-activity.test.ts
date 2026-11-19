import assert from "node:assert/strict";

import * as engine from "@liftboard/engine";

import { activityKey, activityProps, exerciseProgress, setMetaLine, slotWeightLabel } from "./live-activity/state.ts";
import { copy, fill } from "./copy.ts";

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
assert.match(props.setLine, new RegExp(`^Set 1 of ${sets}`));
assert.equal(props.setsDone, 0);
assert.equal(props.setsTotal, sets);
assert.equal(props.setNow, 0);
assert.equal(props.restEnd, 0);
assert.equal(props.finished, false);
assert.equal(props.goLabel, "Go");
assert.equal(props.elapsedLabel, "elapsed");
assert.equal(props.workoutStart, now - 60e3);
assert.equal(props.restUrgent, false);
assert.ok(!props.setLine.includes("·"));

const progress = exerciseProgress(id)!;
assert.equal(progress.index, 1);
assert.ok(progress.total >= 1);
assert.equal(fill(copy.live.exerciseOf, progress.index, progress.total), `Exercise 1 of ${progress.total}`);

assert.equal(setMetaLine("Set 3 of 4", "115 lb", false), "Set 3 of 4 @115 lb");
assert.equal(setMetaLine("Set 3 of 4", "115 lb", true), "Next set @115 lb");

// A ticked set and a rest: the countdown runs to the rest end, and the next set shows.
engine.set(id, first, "log", [{ w: "95", r: "8", d: true }]);
engine.wk.rest = { end: now + 90e3, name: props.exercise };
const before = activityKey(props);
props = activityProps(id, now)!;
assert.equal(props.setsDone, 1);
assert.match(props.setLine, /Next set @/);
assert.ok(props.setLine.includes("95"));
assert.equal(props.restEnd, now + 90e3);
assert.equal(props.restStart, now);
assert.equal(props.restUrgent, false);
assert.notEqual(activityKey(props), before);
// Reading again a second later doesn't count as a change (restStart excluded from key).
assert.equal(activityKey(activityProps(id, now + 1000)), activityKey(props));

// Last 10 seconds: urgent rest colour.
const urgent = activityProps(id, now + 85e3)!;
assert.equal(urgent.restUrgent, true);
assert.notEqual(activityKey(urgent), activityKey(props));

// Rest over: no countdown.
assert.equal(activityProps(id, now + 120e3)!.restEnd, 0);

const weight = slotWeightLabel(id, day, plan, first);
assert.ok(weight);

// Day done.
engine.wk.done = { [id]: true };
props = activityProps(id, now)!;
assert.equal(props.finished, true);
assert.equal(props.restEnd, 0);
assert.equal(props.doneLabel, "✓ Day done");

console.log("live activity ok");
