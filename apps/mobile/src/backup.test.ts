import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as engine from "@liftboard/engine";

import { activeCounts, applyBackup, parseBackup, previewBackup } from "./backup.ts";

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

// A web backup: the preview shows what import will give, and leaves the phone's data alone.
const sample = parseBackup(readFileSync(new URL("./test-fixtures/web-backup-sample.json", import.meta.url), "utf8"));
assert.ok(sample);
const before = JSON.stringify(engine.wk);
const found = previewBackup(sample, engine, store);
assert.equal(JSON.stringify(engine.wk), before);
assert.equal(engine.wk.name, "Emma");
assert.deepEqual(found, { lifts: 5, activities: 3, weeks: 4 });

const phone = new Map<string, string>();
const phoneStore = {
  getItem: (key: string) => phone.get(key) ?? null,
  setItem: (key: string, value: string) => {
    phone.set(key, value);
  },
};
applyBackup(sample, phoneStore, engine);
assert.deepEqual(activeCounts(engine), found);
assert.equal(engine.wk.name, "Sam");
assert.ok(engine.exHist["Back Squat (Barbell)"]?.length === 3);

// An older web save (before lift days were backfilled from set history) counts the backfilled lifts too.
const oldWeek = JSON.parse(sample.keys["liftboard.week.v2"] || "{}");
delete oldWeek.mig5;
const older = { ...sample, keys: { ...sample.keys, "liftboard.week.v2": JSON.stringify(oldWeek) } };
const olderFound = previewBackup(older, engine, phoneStore);
assert.deepEqual(olderFound, { lifts: 6, activities: 3, weeks: 5 });
applyBackup(older, store, engine);
assert.deepEqual(activeCounts(engine), olderFound);

console.log("backup ok");
