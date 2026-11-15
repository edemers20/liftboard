import assert from "node:assert/strict";

import { settleHideScroll, stepHideScroll } from "./hide-scroll.ts";

const height = 80;
let state = { offset: 0, pending: 0 };

function drag(dy: number, y: number) {
  state = stepHideScroll(state, y, dy, height);
}

drag(5, 5);
assert.equal(state.offset, 0, "a nudge under 8pt does not move the header");

drag(4, 9);
assert.equal(state.offset, 1, "past 8pt, only the overflow moves the header");

drag(10, 19);
assert.equal(state.offset, 11, "further scrolling down tracks the finger");

state = { offset: 40, pending: 0 };
drag(-6, 100);
assert.equal(state.offset, 40, "a short scroll up does not bring it back");
drag(-4, 96);
assert.equal(state.offset, 38, "past 8pt up, it follows");

state = { offset: 30, pending: 8 };
drag(-2, 50);
assert.equal(state.pending, -2, "turning around starts the 8pt gate again");
assert.equal(state.offset, 30);

state = { offset: 70, pending: 0 };
drag(40, 200);
assert.equal(state.offset, height, "the header cannot slide further than its height");

assert.equal(stepHideScroll({ offset: 40, pending: 0 }, 0, -20, height).offset, 0, "the top of the page shows it");
assert.equal(settleHideScroll(30, 100, height), 0);
assert.equal(settleHideScroll(40, 100, height), 0);
assert.equal(settleHideScroll(41, 100, height), height);
assert.equal(settleHideScroll(80, 0, height), 0);

console.log("hide-on-scroll ok");
