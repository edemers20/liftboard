/**
 * Live-workout cost model. Builds half a year of training on an in-memory store, starts a workout,
 * then times the engine work one set tap and one render pass cost. Prints timings and sizes only.
 *
 *   npx tsx scripts/live-perf-bench.ts
 */
import { writeFileSync } from "node:fs";

import * as engine from "@liftboard/engine";

import { activityProps, exerciseProgress } from "../src/live-activity/state";

const memory = new Map<string, string>();
let writes = 0;
let bytes = 0;
engine.init({
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    writes++;
    bytes += value.length;
    memory.set(key, value);
  },
});
Object.assign(engine.wk, {
  setupDone: true,
  onbDone: true,
  focus: "Lower",
  days: 4,
  acts: { ...(engine.wk.acts || {}), pickle: true, run: true },
  pickle: "2",
  run: "2",
  mainSport: "pickle",
});
engine.syncDays();

let saves = 0;
engine.setSaveHook(() => {
  saves++;
});

const WEEK = 7 * 864e5;
let t = Date.UTC(2026, 4, 4, 15);
const realNow = Date.now;
Date.now = () => t;

function logDay(id: string) {
  const day = (engine.DAYS as any[]).find((d) => d.id === id);
  const planned = engine.plan().days[id];
  (engine.slotOrder(day) as number[]).forEach((i) => {
    const slot = day.slots[i];
    if (slot.cardio) {
      engine.set(id, i, "cdone", true);
      return;
    }
    const sets = planned.slots[i]?.sets || 0;
    const log = Array.from({ length: sets }, () => ({ w: "95", r: "8", d: true }));
    engine.set(id, i, "log", log);
  });
}

for (let week = 0; week < 26; week++) {
  for (const day of engine.DAYS as any[]) {
    engine.wk.wt = { ...(engine.wk.wt || {}), [day.id]: { start: t } };
    logDay(day.id);
    t += 50 * 6e4;
    engine.markDone(day.id);
    t += 864e5;
  }
  t += WEEK - 4 * 864e5;
  engine.newWeek(t);
}

Date.now = realNow;
t = Date.now();
engine.newWeek(engine.weekStartOf(t).getTime());
engine.dismissWeekReport();
const day = (engine.DAYS as any[])[0];
const id: string = day.id;
const first = (engine.slotOrder(day) as number[]).find((i) => !day.slots[i].cardio)!;
engine.wk.wt = { [id]: { start: t - 20 * 6e4 } };
engine.set(id, first, "log", [{ w: "135", r: "5", d: true }, { w: "135", r: "5", d: true }]);

if (process.env.BENCH_DUMP) {
  writeFileSync(process.env.BENCH_DUMP, JSON.stringify(Object.fromEntries(memory)));
  console.log(`wrote ${process.env.BENCH_DUMP}`);
}

function time(label: string, runs: number, fn: () => void) {
  for (let i = 0; i < 5; i++) fn();
  const start = performance.now();
  for (let i = 0; i < runs; i++) fn();
  const ms = (performance.now() - start) / runs;
  console.log(`${label.padEnd(34)} ${ms.toFixed(3)} ms`);
  return ms;
}

const sizes = [engine.KEY, engine.KEY2, engine.KEY3].map((key: string) => (memory.get(key) || "").length);
console.log(`stored: slots ${sizes[0]} B, wk ${sizes[1]} B, exHist ${sizes[2]} B`);
console.log(`sessions ${engine.wk.sessions.length}, weeks ${engine.wk.weeks.length}`);
console.log("node is ~3-6x faster than Hermes on an iPhone; scale accordingly\n");

const save = time("engine.save()", 200, () => engine.save());
const plan = time("engine.plan()", 200, () => engine.plan());
const P = engine.plan();
time("rowDone (no plan passed)", 200, () => engine.rowDone(id, first));
time("rowDone (plan passed)", 2000, () => engine.rowDone(id, first, P));
time("daySummary", 2000, () => engine.daySummary(id));
time("weekModel(0)", 200, () => engine.weekModel(0, Date.now()));
time("dayBoard(0)", 200, () => engine.dayBoard(0, Date.now()));
time("activityProps (Live Activity)", 200, () => activityProps(id));
time("exerciseProgress (pill identity)", 200, () => exerciseProgress(id));

writes = 0;
bytes = 0;
saves = 0;
const before = engine.get(id, first).log.slice();
const log = before.slice();
log[2] = { w: "135", r: "5", d: true };
engine.set(id, first, "log", log);
engine.beginRest(id, first, 2);
console.log(`\none set tap: ${saves} saves, ${writes} storage writes, ${(bytes / 1024).toFixed(1)} KB stringified`);
console.log(`save ${save.toFixed(2)} ms x ${saves}, plan ${plan.toFixed(2)} ms per call`);
