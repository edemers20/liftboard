/**
 * Build engine-name → workout-guide slug map and copy mapped frame-1 PNGs.
 * Run from apps/mobile: node scripts/build-exercise-images.mjs
 *
 * Curated overrides win. Fuzzy is assist only for anything left out of CURATED.
 * Custom exercises are never mapped (handled at runtime).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { exercises, getExercise, normalizeSearchText, searchExercises } = require("@bryllim/workout-guide");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mobileRoot, "../..");

const engineSrc = fs.readFileSync(path.join(repoRoot, "packages/engine/engine.js"), "utf8");
const LMatch = engineSrc.match(/const L=(\{[\s\S]*?\n\});/);
if (!LMatch) throw new Error("L not found in engine.js");
const L = Function(`"use strict"; return (${LMatch[1]});`)();
const names = [...new Set(Object.values(L).flat())].sort();

const EQUIP_HINTS = [
  [/smith/i, ["Machine", "Smith"]],
  [/machine/i, ["Machine"]],
  [/cable/i, ["Cable"]],
  [/band/i, ["Resistance Band"]],
  [/dumbbell|db\b/i, ["Dumbbell"]],
  [/barbell|ez bar|ez-bar/i, ["Barbell"]],
  [/bodyweight|bw\b/i, ["Bodyweight"]],
  [/kettlebell/i, ["Kettlebell"]],
];

function stripParens(s) {
  return s.replace(/\([^)]*\)/g, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(s) {
  return normalizeSearchText(s).split(/\s+/).filter(Boolean);
}

function scoreCandidate(engineName, ex) {
  const en = normalizeSearchText(stripParens(engineName));
  const enFull = normalizeSearchText(engineName);
  const name = normalizeSearchText(ex.name);
  const slug = normalizeSearchText(ex.slug.replace(/-/g, " "));
  let score = 0;
  if (name === en || slug === en) score += 100;
  if (name === enFull) score += 80;
  const et = new Set(tokens(en));
  const nt = new Set(tokens(`${ex.name} ${ex.slug.replace(/-/g, " ")} ${ex.equipment}`));
  let overlap = 0;
  for (const t of et) if (nt.has(t)) overlap++;
  score += overlap * 8;
  for (const [re, prefs] of EQUIP_HINTS) {
    if (re.test(engineName)) {
      if (prefs.some((p) => ex.equipment.includes(p) || (/smith/i.test(ex.slug) && /smith/i.test(engineName)))) {
        score += 15;
      } else score -= 5;
    }
  }
  if (/bodyweight/i.test(engineName) && ex.equipment === "Bodyweight") score += 20;
  if (!/bodyweight|band/i.test(engineName) && ex.equipment === "Resistance Band") score -= 10;
  return score;
}

/** Curated engine name → slug (exact or sibling). */
const CURATED = {
  "Hip Thrust (Barbell)": "hip-thrust",
  "Hip Thrust (Machine)": "smith-machine-hip-thrust",
  "Smith Hip Thrust": "smith-machine-hip-thrust",
  "Glute Bridge (Barbell)": "barbell-glute-bridge",
  "B-Stance Hip Thrust (Barbell)": "hip-thrust",
  "Hip Thrust (Dumbbell)": "dumbbell-hip-thrust",
  "Banded Hip Thrust": "banded-hip-thrust",
  "Glute Bridge (bodyweight)": "glute-bridge",
  "Romanian Deadlift (Barbell)": "romanian-deadlift",
  "Romanian Deadlift (Dumbbell)": "dumbbell-romanian-deadlift",
  "Single-Leg RDL (Dumbbell)": "single-leg-romanian-deadlift",
  "Stiff-Leg Deadlift": "romanian-deadlift",
  "Sumo Deadlift": "sumo-deadlift",
  "Trap Bar Deadlift": "trap-bar-deadlift",
  "Good Morning": "good-morning",
  "Cable Pull-Through": "cable-pull-through",
  "45° Back Extension (weighted)": "back-extension",
  "Reverse Hyper": "reverse-hyperextension",
  "Single-Leg RDL (bodyweight)": "single-leg-romanian-deadlift",
  "Back Extension (bodyweight)": "back-extension",
  "Bulgarian Split Squat": "bulgarian-split-squat",
  "Bulgarian Split Squat (Smith)": "smith-machine-bulgarian-split-squat",
  "Deficit Reverse Lunge (Dumbbell)": "deficit-reverse-lunge",
  "Reverse Lunge (Dumbbell)": "reverse-lunge",
  "Walking Lunge (Dumbbell)": "walking-lunge",
  "Curtsy Lunge": "curtsy-lunge",
  "Step-Up (Dumbbell)": "step-up",
  "Lateral Step-Up": "step-up",
  "Split Squat (Front-Foot Elevated)": "front-foot-elevated-split-squat",
  "Single-Leg Leg Press": "leg-press",
  "Bulgarian Split Squat (bodyweight)": "bulgarian-split-squat",
  "Reverse Lunge (bodyweight)": "reverse-lunge",
  "Walking Lunge (bodyweight)": "walking-lunge",
  "Step-Up (bodyweight)": "step-up",
  "Skater Squat": "skater-squat",
  "Pistol Squat (to box)": "assisted-pistol-squat",
  "Hip Abductor (Machine)": "hip-abduction-machine",
  "Hip Abductor (Machine, leaning forward)": "hip-abduction-machine",
  "Cable Hip Abduction": "cable-standing-hip-abduction",
  "Banded Lateral Walk": "banded-lateral-walk",
  "Side-Lying Hip Abduction (ankle weight)": "side-lying-hip-abduction",
  "Banded Seated Abduction": "banded-seated-hip-abduction",
  "Side-Lying Hip Abduction (bodyweight)": "side-lying-hip-abduction",
  Clamshell: "clamshell",
  "Fire Hydrant": "fire-hydrant",
  "Side Plank Hip Abduction": "side-plank-hip-dip",
  "Overhead Press (Barbell)": "overhead-press",
  "Overhead Press (Dumbbell, seated)": "seated-dumbbell-press",
  "Overhead Press (Dumbbell, standing)": "standing-dumbbell-press",
  "Arnold Press": "arnold-press",
  "Shoulder Press (Machine)": "machine-shoulder-press",
  "Landmine Press": "landmine-press",
  "Half-Kneeling Landmine Press": "landmine-press",
  "Smith Overhead Press": "machine-shoulder-press",
  "Pike Push-Up": "pike-push-up",
  "Lat Pulldown (Single Arm)": "lat-pulldown",
  "Lat Pulldown (Wide)": "wide-grip-lat-pulldown",
  "Lat Pulldown (Close Neutral Grip)": "close-grip-lat-pulldown",
  "Lat Pulldown (Underhand)": "lat-pulldown",
  "Assisted Pull-Up": "assisted-pull-up",
  "Pull-Up": "pull-up",
  "Chin-Up": "chin-up",
  "Negative Pull-Up": "negative-pull-up",
  "Kneeling Single-Arm Cable Pulldown": "lat-pulldown",
  "Scapular Pull-Up": "scapular-pull-up",
  "Incline Chest Press (Machine)": "machine-chest-press",
  "Incline Dumbbell Press": "incline-dumbbell-press",
  "Incline Barbell Bench": "incline-bench-press",
  "Chest Press (Machine)": "machine-chest-press",
  "Flat Dumbbell Press": "dumbbell-bench-press",
  "Push-Up (deficit or weighted)": "weighted-push-up",
  "Cable Fly": "cable-fly",
  "Pec Deck": "pec-deck",
  "Push-Up": "push-up",
  "Incline Push-Up": "incline-push-up",
  "Decline Push-Up": "decline-push-up",
  Dips: "chest-dip",
  "Seated Row (Cable)": "seated-row",
  "Seated Row (Cable, wide bar)": "seated-row",
  "Single-Arm Cable Row": "single-arm-cable-row",
  "Chest-Supported Row (Dumbbell)": "chest-supported-row",
  "Chest-Supported Row (Machine)": "chest-supported-row",
  "Bent-Over Row (Dumbbell)": "dumbbell-bent-over-row",
  "Single-Arm Dumbbell Row": "one-arm-dumbbell-row",
  "Machine Row": "machine-row",
  "Inverted Row": "inverted-row",
  "Inverted Row (feet elevated)": "inverted-row",
  "Bent-Over Row (Barbell)": "barbell-row",
  "Pendlay Row": "pendlay-row",
  "Seal Row": "chest-supported-row",
  "T-Bar Row": "t-bar-row",
  "Meadows Row": "meadows-row",
  "Lateral Raise (Dumbbell)": "lateral-raise",
  "Cable Lateral Raise": "cable-lateral-raise",
  "Lateral Raise (Machine)": "machine-lateral-raise",
  "Lean-Away Lateral Raise": "lateral-raise",
  "Seated Lateral Raise": "lateral-raise",
  "Lateral Raise Partials (burnout)": "lateral-raise",
  "Upright Row (Cable, wide)": "upright-row",
  "Face Pull (Cable)": "face-pull",
  "Reverse Fly (Cable)": "cable-rear-delt-fly",
  "Reverse Fly (Machine)": "reverse-pec-deck",
  "Reverse Fly (Dumbbell, chest-supported)": "rear-delt-fly",
  "Band Pull-Apart": "band-pull-apart",
  "Rear Delt Row (Cable)": "cable-rear-delt-fly",
  "Bicep Curl (Dumbbell)": "bicep-curl",
  "Hammer Curl": "hammer-curl",
  "Incline Dumbbell Curl": "incline-dumbbell-curl",
  "Cable Curl": "cable-curl",
  "Preacher Curl (Machine)": "preacher-curl",
  "Triceps Pushdown (Cable)": "tricep-pushdown",
  "Overhead Triceps Extension (Cable)": "overhead-tricep-extension",
  "Skull Crusher (EZ bar)": "skull-crusher",
  "Dips (assisted)": "assisted-dip",
  "Bench Dip": "bench-dip",
  "Diamond Push-Up": "diamond-push-up",
  "Hack Squat": "hack-squat",
  "Box Squat (Barbell)": "squat",
  "Back Squat (Barbell)": "squat",
  "Front Squat": "front-squat",
  "Smith Squat": "smith-machine-squat",
  "Leg Press": "leg-press",
  "Pendulum Squat": "hack-squat",
  "Goblet Squat (heel-elevated)": "heel-elevated-goblet-squat",
  "Belt Squat": "belt-squat",
  "Air Squat": "bodyweight-squat",
  "Jump Squat": "jump-squat",
  "Wall Sit": "wall-sit",
  "Sissy Squat": "sissy-squat",
  "Single-Leg Hip Thrust": "hip-thrust",
  "Hip Thrust (Barbell), 60–70%": "hip-thrust",
  "Cable Kickback": "cable-kickback",
  "Glute Kickback (Machine)": "machine-glute-kickback",
  "45° Back Extension (glute bias)": "glute-focused-back-extension",
  "Frog Pump (Dumbbell)": "frog-pump",
  "Single-Leg Glute Bridge (bodyweight)": "single-leg-glute-bridge",
  "Frog Pump (bodyweight)": "frog-pump",
  "Donkey Kick (bodyweight)": "donkey-kick",
  "Leg Curl (Seated)": "seated-leg-curl",
  "Leg Curl (Lying)": "lying-leg-curl",
  "Single-Leg Leg Curl": "lying-leg-curl",
  "Nordic Curl (assisted)": "nordic-hamstring-curl",
  "Stability Ball Curl": "stability-ball-hamstring-curl",
  "Sliding Leg Curl": "towel-hamstring-curl",
  "Nordic Curl": "nordic-hamstring-curl",
  "Single-Leg Sliding Leg Curl": "towel-hamstring-curl",
  "Straight Arm Pulldown": "straight-arm-pulldown",
  "Cable Pullover": "straight-arm-pulldown",
  "Dumbbell Pullover": "straight-arm-pulldown",
  "Standing Calf Raise (Machine)": "standing-calf-raise",
  "Seated Calf Raise": "seated-calf-raise",
  "Single-Leg Calf Raise (Dumbbell)": "single-leg-calf-raise",
  "Smith Calf Raise": "standing-calf-raise",
  "Leg Press Calf Raise": "leg-press-calf-raise",
  "Calf Raise (bodyweight)": "calf-raise",
  "Single-Leg Calf Raise (bodyweight)": "single-leg-calf-raise",
  "Copenhagen Plank": "copenhagen-plank",
  "Hip Adductor (Machine)": "hip-adduction-machine",
  "Cable Hip Adduction": "cable-standing-hip-adduction",
  "Lateral Lunge (Dumbbell)": "dumbbell-lateral-lunge",
  "Cossack Squat": "cossack-squat",
  "Side-Lying Adduction (bodyweight)": "side-lying-leg-raise",
  "Prone Y-Raise": "prone-y-raise",
  "Pallof Press": "pallof-press",
  "Dead Bug": "dead-bug",
  "Hanging Knee Raise": "hanging-knee-raise",
  "Ab Wheel": "ab-wheel",
  "Cable Crunch": "cable-crunch",
  "Side Plank": "side-plank",
  "Suitcase Carry": "farmer-carry",
  Plank: "plank",
  "Hollow Hold": "hollow-body-hold",
  "Hanging Leg Raise": "hanging-leg-raise",
  "Reverse Crunch": "reverse-crunch",
  "Bird Dog": "bird-dog",
  "Mountain Climber": "mountain-climber",
  "V-Up": "v-up",
};

/** No close sibling in the library; leave blank. */
const NO_IMAGE = new Set([
  "Cable External Rotation",
  "Side-Lying External Rotation (Dumbbell)",
  "Band External Rotation",
]);

const map = {};
const report = [];

for (const name of names) {
  if (NO_IMAGE.has(name)) {
    report.push({ name, slug: null, how: "blank" });
    continue;
  }
  if (CURATED[name]) {
    const slug = CURATED[name];
    if (!getExercise(slug)) throw new Error(`Bad curated slug ${slug} for ${name}`);
    map[name] = slug;
    report.push({ name, slug, how: "curated" });
    continue;
  }
  const q = stripParens(name);
  const hits = searchExercises(q);
  let best = null;
  let bestScore = 0;
  const pool = hits.length ? hits : exercises;
  for (const ex of pool) {
    const s = scoreCandidate(name, ex);
    if (s > bestScore) {
      bestScore = s;
      best = ex;
    }
  }
  if (best && bestScore >= 40) {
    map[name] = best.slug;
    report.push({ name, slug: best.slug, how: `fuzzy:${bestScore}` });
  } else {
    report.push({ name, slug: null, how: `miss:${bestScore}:${best && best.slug}` });
  }
}

const slugs = [...new Set(Object.values(map))].sort();
console.log(`Mapped ${Object.keys(map).length}/${names.length}; unique slugs ${slugs.length}`);
const unmapped = report.filter((r) => !r.slug);
if (unmapped.length) {
  console.log("Unmapped:");
  for (const r of unmapped) console.log(`  ${r.name} (${r.how})`);
}

const outDir = path.join(mobileRoot, "src/exercise-images");
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "slug-map.ts"),
  `/** Engine exercise name → @bryllim/workout-guide slug (sibling when no exact match).\n * Generated by scripts/build-exercise-images.mjs; edit CURATED there and re-run.\n */\nexport const EXERCISE_IMAGE_SLUGS: Record<string, string> = ${JSON.stringify(map, null, 2)};\n`,
);

// Metro-bundled requires from the package (frame-1 only for mapped slugs). Offline when toggle is on.
const assetLines = slugs.map(
  (s) => `  ${JSON.stringify(s)}: require("@bryllim/workout-guide/assets/${s}/frame-1.png"),`,
);
fs.writeFileSync(
  path.join(outDir, "assets.ts"),
  `/** Bundled Workout Guide frame-1 PNGs for mapped engine exercises. CC BY-SA 4.0.\n * Generated by scripts/build-exercise-images.mjs.\n */\nimport type { ImageSourcePropType } from "react-native";\n\nexport const EXERCISE_IMAGE_ASSETS: Record<string, ImageSourcePropType> = {\n${assetLines.join("\n")}\n};\n`,
);

console.log("Wrote", outDir);
