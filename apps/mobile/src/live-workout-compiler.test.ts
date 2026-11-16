import assert from "node:assert/strict";
import { transformFileSync } from "@babel/core";
import { fileURLToPath } from "node:url";

// The engine mutates `wk` in place, so React Compiler caches can't see a new workout start.
const file = fileURLToPath(new URL("./components/live-workout.tsx", import.meta.url));
const code =
  transformFileSync(file, {
    babelrc: false,
    configFile: false,
    presets: [["@babel/preset-typescript", { isTSX: true, allExtensions: true }]],
    plugins: ["babel-plugin-react-compiler", "@babel/plugin-syntax-jsx"],
  })?.code || "";

const start = code.indexOf("function useLiveWorkout(");
assert.ok(start >= 0, "useLiveWorkout is compiled");
const end = code.indexOf("\nfunction ", start + 1);
const body = code.slice(start, end < 0 ? undefined : end);
assert.ok(!/_c\(\d+\)/.test(body), "useLiveWorkout is not memoized, so the pill reads the workout on every store change");

console.log("live-workout compiler ok");
