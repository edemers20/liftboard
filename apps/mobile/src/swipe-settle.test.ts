import assert from "node:assert/strict";

import { createSwipeRegistry, SWIPE_WIDTH as W, swipeActionShown, swipeDrag, swipeFullAt, swipeSettle } from "./swipe-settle.ts";

// Dragging stays between closed and fully open.
assert.equal(swipeDrag(0, 30), 0, "can't drag right of closed");
assert.equal(swipeDrag(0, -300), -W, "can't drag past fully open");
assert.equal(swipeDrag(-W, 20), -W + 20, "drag back from open");
assert.equal(swipeDrag(0, Number.NaN), 0, "a broken event leaves the row where it started");

// Every release or cancel rests at exactly closed or exactly open.
for (let x = -W; x <= 0; x += 1) {
  for (const v of [-2000, -600, -200, 0, 200, 600, 2000, Number.NaN]) {
    const to = swipeSettle(x, v);
    assert.ok(to === 0 || to === -W, `x=${x} v=${v} settles at an end, got ${to}`);
  }
}
assert.equal(swipeSettle(-10, 0), 0, "a small nudge springs back");
assert.equal(swipeSettle(-W / 2 + 1, 0), 0, "just short of half springs back");
assert.equal(swipeSettle(-W / 2 - 1, 0), -W, "past half opens");
assert.equal(swipeSettle(-20, -800), -W, "a quick flick left opens");
assert.equal(swipeSettle(-W, 800), 0, "a quick flick right closes");
assert.equal(swipeSettle(-60, 0), -W, "an interrupted swipe (no velocity) past half opens");
assert.equal(swipeSettle(-30, 0), 0, "an interrupted swipe (no velocity) short of half closes");
assert.equal(swipeSettle(Number.NaN, 0), 0, "an unknown position closes");

// A full swipe (iOS Mail style) deletes; anything short of it still opens or closes.
const R = 360;
const full = swipeFullAt(R);
assert.equal(full, R * 0.55, "the full-swipe point is over half a phone-width row");
assert.equal(swipeFullAt(150), Infinity, "a row too narrow has no full swipe");
assert.equal(swipeFullAt(0), Infinity, "an unmeasured row has no full swipe");
assert.equal(swipeDrag(0, -500, W, R), -R, "a full swipe drags to the row's edge, no further");
assert.equal(swipeDrag(0, -500, W, 0), -W, "an unmeasured row stops at fully open");
assert.equal(swipeSettle(-full, 0, W, R), -R, "let go at the full-swipe point deletes");
assert.equal(swipeSettle(-R, 900, W, R), -R, "a full swipe deletes even if the finger flicks back at the end");
assert.equal(swipeSettle(-full + 1, 0, W, R), -W, "just short of it opens");
assert.equal(swipeSettle(-20, -3000, W, R), -W, "a fast flick from closed opens, never deletes");
assert.equal(swipeSettle(-full + 1, 800, W, R), 0, "a flick right from past open closes");
for (let x = -R; x <= 0; x += 1) {
  for (const v of [-2000, -600, 0, 600, 2000, Number.NaN]) {
    const to = swipeSettle(x, v, W, R);
    assert.ok(to === 0 || to === -W || to === -R, `x=${x} v=${v} settles closed, open or deleted, got ${to}`);
    assert.equal(to === -R, x <= -full, `x=${x} v=${v} deletes only past the full-swipe point`);
  }
}

// Delete is hidden at rest.
assert.equal(swipeActionShown(0), false, "hidden at rest");
assert.equal(swipeActionShown(-0.2), false, "hidden at rounding noise");
assert.equal(swipeActionShown(-5), true, "shows once the row moves");

// One open row; touches elsewhere close it; its Delete button doesn't.
const rows = createSwipeRegistry();
const a = {};
const b = {};
const closed: string[] = [];
rows.claim(a, () => closed.push("a"));
rows.setRect(a, { x: 300, y: 100, width: 88, height: 44 });
rows.touch(340, 120);
assert.deepEqual(closed, [], "touching Delete keeps the row open");
assert.ok(rows.isOpen(a));
rows.claim(b, () => closed.push("b"));
assert.deepEqual(closed, ["a"], "swiping another row closes the open one");
rows.touch(10, 10);
assert.deepEqual(closed, ["a", "b"], "a touch elsewhere closes the open row");
assert.equal(rows.isOpen(b), false);
rows.touch(10, 10);
assert.deepEqual(closed, ["a", "b"], "nothing open, nothing to close");
rows.claim(a, () => closed.push("a"));
rows.release(a);
rows.closeAll();
assert.deepEqual(closed, ["a", "b"], "a deleted (unmounted) row is forgotten");

console.log("swipe-settle ok");
