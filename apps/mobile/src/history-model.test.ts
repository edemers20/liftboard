import assert from "node:assert/strict";

import {
  buildWeekMix,
  displayWeight,
  dueWeekStart,
  formatAverage,
  formatHours,
  linePoints,
  trendPoints,
  monthGrid,
  sparkPoints,
  weekRange,
  weekStart,
} from "./history-model.ts";

const november = monthGrid(2026, 10);
assert.equal(november.lead, 6);
assert.equal(november.days, 30);
assert.equal(november.cells[6]?.day, 1);
assert.equal(november.cells[6]?.key, "2026-10-1");
assert.equal(november.cells.at(-1)?.day, 30);
assert.equal((november.cells.length - 1) % 7, 0);

const june = monthGrid(2026, 5);
assert.equal(june.lead, 0);
assert.equal(june.days, 30);

assert.equal(formatHours(30), "0.5h");
assert.equal(formatAverage(45), "45m");
assert.equal(formatAverage(90), "1.5h");
assert.equal(formatAverage(120), "2h");
assert.equal(formatHours(90), "1.5h");
assert.equal(formatHours(420), "7h");
assert.equal(formatHours(600), "10h");
assert.equal(formatHours(20), "0.5h");

assert.equal(displayWeight(140, "lb"), 140);
assert.equal(displayWeight(110, "kg"), Math.round((110 / 2.20462) * 10) / 10);
assert.equal(displayWeight(2.20462, "kg"), 1);

const points = sparkPoints([100, 110, 105]);
assert.deepEqual(points, [
  { x: 4, y: 28 },
  { x: 56, y: 4 },
  { x: 108, y: 16 },
]);
assert.deepEqual(sparkPoints([80]), [{ x: 56, y: 16 }]);
assert.deepEqual(sparkPoints([40, 40]), [
  { x: 4, y: 16 },
  { x: 108, y: 16 },
]);

assert.deepEqual(linePoints([100, 120]), [
  { x: 4, y: 40 },
  { x: 92, y: 6 },
]);
assert.deepEqual(linePoints([80, 80]), [
  { x: 4, y: 40 },
  { x: 92, y: 40 },
]);
assert.deepEqual(linePoints([50]), [{ x: 48, y: 40 }]);

const rising = trendPoints([0, 0.05, 0.1]);
assert.deepEqual(rising.points, [
  { x: 4, y: 28 },
  { x: 48, y: 16 },
  { x: 92, y: 4 },
]);
assert.equal(rising.zero, 28);
const flat = trendPoints([0.01, -0.01, 0]);
assert.ok(flat.points.every((point) => point.y >= 10 && point.y <= 22));
assert.equal(flat.zero, 16);
const falling = trendPoints([0, -0.03, -0.06]);
assert.ok(falling.points[2].y > falling.points[0].y);
assert.equal(falling.zero, 4);

const nov2 = new Date(2026, 10, 2).getTime();
const oct26 = new Date(2026, 9, 26).getTime();
assert.equal(weekRange(nov2), "Nov 2 – 8");
assert.equal(weekRange(oct26), "Oct 26 – Nov 1");

const now = new Date(2026, 10, 8, 12).getTime();
const thisWeek = new Date(2026, 10, 2, 12).getTime();
const one = buildWeekMix([{ t: thisWeek, kind: "lift", minutes: 60 }], now, "Mon");
assert.equal(one.weeks.length, 1);
assert.equal(one.weeks[0]?.total, 60);
assert.equal(one.averageMinutes, 0);
assert.equal(one.max, 60);

const earlier = new Date(2026, 9, 12, 12).getTime();
const four = buildWeekMix(
  [
    { t: earlier, kind: "sport", minutes: 90 },
    { t: thisWeek, kind: "lift", minutes: 60 },
  ],
  now,
  "Mon",
);
assert.equal(four.weeks.length, 4);
assert.equal(four.weeks[0]?.minutes.sport, 90);
assert.equal(four.weeks[3]?.minutes.lift, 60);
assert.equal(four.weeks[3]?.current, true);
assert.equal(four.averageMinutes, 90);

const sunday = buildWeekMix([{ t: thisWeek, kind: "cardio", minutes: 45 }], now, "Sun");
assert.equal(sunday.weeks.length, 2);
assert.equal(sunday.weeks[0]?.minutes.cardio, 45);
assert.equal(sunday.weeks[1]?.total, 0);

const monday = weekStart(new Date(2026, 10, 9).getTime(), "Mon");
const previous = weekStart(new Date(2026, 10, 2).getTime(), "Mon");
assert.equal(dueWeekStart(previous, new Date(2026, 10, 9, 8).getTime(), "Mon"), monday);
assert.equal(dueWeekStart(monday, new Date(2026, 10, 10).getTime(), "Mon"), null);
assert.equal(dueWeekStart(undefined, new Date(2026, 10, 9).getTime(), "Mon"), null);

console.log("history-model ok");
