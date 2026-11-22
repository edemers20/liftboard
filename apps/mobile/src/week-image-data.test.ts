import assert from "node:assert/strict";

import { buildWeekImage, weekDays } from "./week-image-data.ts";

const monday = new Date(2026, 10, 16).getTime();
const at = (day: number, hour: number) => new Date(2026, 10, 16 + day, hour).getTime();

const sessions = [
  { t: at(0, 7), k: "lift" },
  { t: at(1, 18), k: "pickleball" },
  { t: at(5, 9), k: "lift" },
  { t: at(5, 17), k: "zone2" },
  { t: at(7, 8), k: "lift" },
  { t: at(-1, 20), k: "tennis" },
];
const days = weekDays(monday, sessions, [at(5, 9), at(9, 9)]);
assert.equal(days.length, 7);
assert.deepEqual(
  days.map((day) => [day.weekday, day.lift, day.activity, day.pr]),
  [
    [0, true, false, false],
    [1, false, true, false],
    [2, false, false, false],
    [3, false, false, false],
    [4, false, false, false],
    [5, true, true, true],
    [6, false, false, false],
  ],
);

const sunday = new Date(2026, 10, 15).getTime();
assert.deepEqual(
  weekDays(sunday, [], []).map((day) => day.weekday),
  [6, 0, 1, 2, 3, 4, 5],
);

const image = buildWeekImage({
  start: monday,
  sessions,
  prTimes: [],
  prs: 2,
  streak: 0,
  strength: { upper: { spark: [0, 0.01, 0.03] }, lower: { spark: [0.02] } },
});
assert.deepEqual(image.upper, [0, 0.01, 0.03]);
assert.equal(image.lower, null);
assert.equal(image.streak, 0);
assert.equal(image.prs, 2);
assert.equal(buildWeekImage({ start: monday, sessions: [], prTimes: [], prs: 0, streak: 3, strength: { upper: null, lower: null } }).upper, null);

console.log("week-image-data ok");
