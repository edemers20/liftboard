import assert from "node:assert/strict";

import { createScrollTick } from "./scroll-tick.ts";

const tick = createScrollTick(158, 60);
assert.equal(tick(0, 0), false, "the first reading only sets where the list is");
assert.equal(tick(40, 100), false, "inside the first card, no tick");
assert.equal(tick(80, 200), true, "past halfway onto the next card ticks");
assert.equal(tick(120, 210), false, "still on that card");
assert.equal(tick(240, 220), false, "the next card within 60 ms is skipped");
assert.equal(tick(400, 400), true, "a later card ticks again");
assert.equal(tick(230, 500), true, "scrolling back ticks too");
assert.equal(tick(-30, 600), true, "the overscroll at the start counts as the first card");
assert.equal(tick(-60, 700), false, "and stays there");
assert.equal(tick(Number.NaN, 800), false, "a broken event does nothing");

const fling = createScrollTick(158, 60);
fling(0, 0);
let ticks = 0;
for (let t = 16, x = 0; t <= 480; t += 16, x += 120) if (fling(x, t)) ticks++;
assert.ok(ticks <= 480 / 60 + 1, `a fast fling is throttled (${ticks} ticks)`);
assert.ok(ticks >= 3, "but still ticks along the way");

console.log("scroll-tick ok");
