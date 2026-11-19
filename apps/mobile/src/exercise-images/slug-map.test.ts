import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EXERCISE_IMAGE_SLUGS } from "./slug-map.ts";

const require = createRequire(import.meta.url);
const { getExercise } = require("@bryllim/workout-guide");
const here = dirname(fileURLToPath(import.meta.url));

for (const [name, slug] of Object.entries(EXERCISE_IMAGE_SLUGS)) {
  assert.ok(getExercise(slug), `${name} → missing workout-guide slug ${slug}`);
}

assert.equal(EXERCISE_IMAGE_SLUGS["+ Custom…"], undefined);
assert.equal(EXERCISE_IMAGE_SLUGS["Custom exercise"], undefined);
assert.equal(EXERCISE_IMAGE_SLUGS["Cable External Rotation"], undefined);

const assets = readFileSync(join(here, "assets.ts"), "utf8");
for (const slug of new Set(Object.values(EXERCISE_IMAGE_SLUGS))) {
  assert.match(assets, new RegExp(`"${slug}": require\\("@bryllim/workout-guide/assets/${slug}/frame-1\\.png"\\)`));
}

console.log(`ok exercise-image map (${Object.keys(EXERCISE_IMAGE_SLUGS).length} names)`);
