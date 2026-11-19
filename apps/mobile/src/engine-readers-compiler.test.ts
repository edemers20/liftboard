import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "@babel/core";

// The engine mutates `wk` in place. React Compiler caches can't see that, so a memoized
// component or hook keeps showing old values. Anything that reaches the engine, directly
// or through another module, must stay out of the compiler.
const root = dirname(fileURLToPath(import.meta.url));
const ENGINE = ["@/store", "@liftboard/engine"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.(test|d)\.ts$/.test(name) && !/\.web\.tsx?$/.test(name) ? [path] : [];
  });
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const path of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

const files = walk(root);
const source = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
const imports = new Map<string, string[]>();
const direct = new Set<string>();
for (const file of files) {
  const specs = [...source.get(file)!.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)].map((match) => match[1]);
  if (specs.some((spec) => ENGINE.includes(spec) || resolveImport(file, spec) === join(root, "store.ts"))) direct.add(file);
  imports.set(file, specs.map((spec) => resolveImport(file, spec)).filter((path): path is string => !!path));
}

const readers = new Set(direct);
for (let grew = true; grew; ) {
  grew = false;
  for (const file of files) {
    if (readers.has(file)) continue;
    if (imports.get(file)!.some((dep) => readers.has(dep))) {
      readers.add(file);
      grew = true;
    }
  }
}

for (const must of ["app/(tabs)/index.tsx", "app/(tabs)/plan.tsx", "components/history-tab.tsx", "components/you-tab.tsx", "components/live-workout.tsx", "week-report.tsx", "workout/share-card.tsx"]) {
  assert.ok(readers.has(join(root, must)), `${must} is found as an engine reader`);
}

// Screens that sit at the root of a tab or route redraw from the store version; their children redraw with them.
for (const screen of ["app/(tabs)/index.tsx", "app/(tabs)/plan.tsx", "app/(tabs)/history.tsx", "app/(tabs)/_layout.tsx", "components/profile-screen.tsx", "components/you-tab.tsx", "workout/screen.tsx", "app/activity/[t].tsx", "app/sheet-report.tsx", "week-report.tsx", "components/live-workout.tsx", "components/swap-sheet.tsx"]) {
  assert.match(
    source.get(join(root, screen))!,
    /useEngineStore\(\(state\) => state\.version\)|useEngineVersion\(\)|useProfileName\(\)|useEngineStore\(\(\) => /,
    `${screen} subscribes to the store version`,
  );
}

const memoized: string[] = [];
for (const file of readers) {
  const code =
    transformSync(source.get(file)!, {
      filename: file,
      babelrc: false,
      configFile: false,
      presets: [["@babel/preset-typescript", { isTSX: file.endsWith(".tsx"), allExtensions: true }]],
      plugins: ["babel-plugin-react-compiler", "@babel/plugin-syntax-jsx"],
    })?.code || "";
  if (/\b_c\(\d+\)/.test(code)) memoized.push(relative(root, file));
}

assert.deepEqual(memoized.sort(), [], `engine readers memoized by React Compiler; add "use no memo" at the top of the file:\n${memoized.join("\n")}`);

console.log(`engine readers compiler ok (${readers.size} files)`);
