import assert from "node:assert/strict";

import { scrubEvent, scrubText } from "./crash/scrub.ts";

assert.equal(scrubText(`Bad weight "135" for Bench`), `Bad weight "…" for Bench`);
assert.equal(scrubText("Body fat 22.5 at 140 lb"), "Body fat # at # lb");
assert.equal(scrubText("note 'sore knee after 3 sets'"), "note '…'");
assert.equal(scrubText("from emma@example.com"), "from <email>");
assert.equal(scrubText("x".repeat(500))!.length, 200);
assert.equal(scrubText(undefined), undefined);

const event = {
  event_id: "abc",
  timestamp: 1,
  platform: "javascript",
  level: "error",
  release: "app.liftboard@1.0.0+12",
  environment: "production",
  message: { formatted: "Weight 140 saved" },
  exception: {
    values: [
      {
        type: "TypeError",
        value: `Cannot read property 'w' of undefined (log {"w":135,"r":8,"note":"cycle day 2"})`,
        mechanism: { type: "onerror", handled: false, data: { secret: 1 } },
        stacktrace: {
          frames: [
            { filename: "app:///index.bundle", function: "save", lineno: 10, colno: 2, in_app: true, vars: { weight: 140 }, context_line: "const w = 140" },
          ],
        },
      },
    ],
  },
  breadcrumbs: [{ message: "tapped Bench Press 135 × 8" }],
  extra: { wk: { weight: 140 } },
  user: { email: "emma@example.com", ip_address: "1.2.3.4" },
  tags: { route: "/workout/d1" },
  request: { url: "liftboard://workout/d1" },
  contexts: {
    os: { name: "iOS", version: "26.1" },
    device: { model: "iPhone17,1", family: "iOS", name: "Emma's iPhone" },
    app: { app_version: "1.0.0", app_build: "12", app_memory: 1 },
    react_native_context: { component_stack: "in WeightRow" },
    expo_constants: { manifest: {} },
  },
  debug_meta: { images: [{ type: "macho", uuid: "u" }] },
};

const out = scrubEvent(event) as any;
assert.deepEqual(Object.keys(out).sort(), ["contexts", "debug_meta", "environment", "event_id", "exception", "level", "message", "platform", "release", "timestamp"]);
assert.equal(out.message, "Weight # saved");
assert.equal(out.exception.values[0].type, "TypeError");
assert.equal(out.exception.values[0].value, "Cannot read property '…' of undefined (log {\"…\":#,\"…\":#,\"…\":\"…\"})");
assert.deepEqual(out.exception.values[0].mechanism, { type: "onerror", handled: false });
assert.deepEqual(out.exception.values[0].stacktrace.frames[0], { filename: "app:///index.bundle", function: "save", lineno: 10, colno: 2, in_app: true });
assert.deepEqual(out.contexts, {
  os: { name: "iOS", version: "26.1" },
  device: { model: "iPhone17,1", family: "iOS" },
  app: { app_version: "1.0.0", app_build: "12" },
});
const text = JSON.stringify(out);
for (const leak of ["135", "140", "cycle", "emma", "Emma", "Bench", "workout/d1", "1.2.3.4", "WeightRow"]) assert.ok(!text.includes(leak), leak);

console.log("crash scrub ok");
