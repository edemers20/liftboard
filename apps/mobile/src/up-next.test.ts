import assert from "node:assert/strict";

import * as engine from "@liftboard/engine";

import { restUpNext } from "./workout/up-next.ts";

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
const plan = engine.plan();
const lifts = (engine.slotOrder(day) as number[]).filter((index) => !day.slots[index].cardio && !plan.days[id].slots[index].skip);
const [first, second] = lifts;
const name = engine.exName(day, day.slots[first], first);
const secondName = engine.exName(day, day.slots[second], second);
const sets = plan.days[id].slots[first].sets as number;
const up = (set: number, total: number, name: string) => ({ set, total, name });
const tick = { w: "100", r: "8", d: true };
engine.wk.wt = { [id]: { start: Date.now() } };

// Mid-exercise: the next set.
engine.set(id, first, "log", [tick]);
assert.deepEqual(restUpNext(name), up(2, sets, name));

// All planned sets ticked: the next exercise.
engine.set(id, first, "log", Array.from({ length: sets }, () => tick));
assert.deepEqual(restUpNext(name), up(1, plan.days[id].slots[second].sets, secondName));

// A set added mid-exercise comes first, and the exercise isn't done yet.
engine.set(id, first, "log", [...Array.from({ length: sets }, () => tick), {}]);
assert.deepEqual(restUpNext(name), up(sets + 1, sets + 1, name), "the added set is up next");
assert.equal(engine.rowDone(id, first), false, "the workout screen keeps this exercise current");
assert.equal(engine.dayComplete(id), false);

// Once the added set is ticked, the next exercise.
engine.set(id, first, "log", Array.from({ length: sets + 1 }, () => tick));
assert.deepEqual(restUpNext(name), up(1, plan.days[id].slots[second].sets, secondName));
assert.equal(engine.rowDone(id, first), true);

console.log("up-next ok");
