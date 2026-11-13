import assert from "node:assert/strict";

import * as engine from "@liftboard/engine";

import { activeCounts, applyBackup, parseBackup } from "./backup.ts";

assert.equal(parseBackup("nope"), null);
assert.equal(parseBackup(JSON.stringify({ app: "other", keys: {} })), null);
assert.equal(parseBackup(JSON.stringify({ app: "liftboard", keys: { a: 1 } })), null);

const memory = new Map<string, string>();
const store = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
};

const sameWeek = new Date(2026, 10, 3, 12).getTime();
const alsoSameWeek = new Date(2026, 10, 5, 18).getTime();
const nextWeek = new Date(2026, 10, 10, 12).getTime();
const week = {
  setupDone: true,
  mig1: 1,
  mig2: 1,
  mig3: 1,
  mig4: 1,
  mig5: 1,
  mig6: 1,
  wkStart: "Mon",
  name: "Emma",
  sessions: [
    { t: sameWeek, k: "lift" },
    { t: alsoSameWeek, k: "pickle" },
    { t: nextWeek, k: "lift" },
  ],
};
const file = JSON.stringify({
  app: "liftboard",
  v: 1,
  at: "2026-11-10T15:00:00.000Z",
  keys: {
    "liftboard.v1": "{}",
    "liftboard.week.v2": JSON.stringify(week),
    "liftboard.hist.v1": "{}",
  },
});
const backup = parseBackup(file);
assert.ok(backup);

applyBackup(backup, store, engine);
assert.equal(engine.wk.name, "Emma");
assert.equal(engine.wk.onbDone, true);
assert.deepEqual(activeCounts(engine), { lifts: 2, activities: 1, weeks: 2 });

console.log("backup ok");
