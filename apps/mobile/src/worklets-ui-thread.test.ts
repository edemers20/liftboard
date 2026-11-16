import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { parseSync, transformSync, traverse } from "@babel/core";

import * as settle from "./swipe-settle.ts";

// Worklets run on the UI thread with only the values they captured. The worklets plugin unpacks
// those inside the function body, after default parameters run, so a default like
// `width = SWIPE_WIDTH` crashed the first swipe ("Property 'SWIPE_WIDTH' doesn't exist").
const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const plugin = require.resolve("react-native-worklets/plugin");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.(test|d)\.ts$/.test(name) ? [path] : [];
  });
}

/** Each worklet's UI-thread source, as the plugin builds it. */
function workletCodes(path: string): string[] {
  const out = transformSync(readFileSync(path, "utf8"), {
    filename: path,
    babelrc: false,
    configFile: false,
    presets: [["@babel/preset-typescript", { isTSX: path.endsWith(".tsx"), allExtensions: true }]],
    plugins: [plugin],
    ast: true,
    code: false,
  });
  const codes: string[] = [];
  traverse(out!.ast!, {
    VariableDeclarator(p) {
      const id = p.node.id;
      const init = p.node.init;
      if (id.type !== "Identifier" || !/_init_data$/.test(id.name) || init?.type !== "ObjectExpression") return;
      for (const prop of init.properties) {
        if (prop.type === "ObjectProperty" && prop.key.type === "Identifier" && prop.key.name === "code" && prop.value.type === "StringLiteral") {
          codes.push(prop.value.value);
        }
      }
    },
  });
  return codes;
}

function closureNames(code: string): string[] {
  const m = code.match(/const\s*\[([^\]]*)\]\s*=\s*this\.__closure/) || code.match(/const\s*\{([^}]*)\}\s*=\s*this\.__closure/);
  return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** Names a worklet's parameter list reads (defaults and destructuring defaults). */
function paramReads(code: string): string[] {
  const ast = parseSync(code, { babelrc: false, configFile: false });
  const names = new Set<string>();
  let done = false;
  traverse(ast!, {
    Function(p) {
      if (done) return;
      done = true;
      for (const param of p.get("params")) {
        param.traverse({
          Identifier(q) {
            if (q.isReferencedIdentifier()) names.add(q.node.name);
          },
        });
      }
      p.stop();
    },
  });
  return [...names];
}

let count = 0;
for (const path of walk(root)) {
  if (!readFileSync(path, "utf8").includes('"worklet"')) continue;
  for (const code of workletCodes(path)) {
    count++;
    const captured = closureNames(code);
    const late = paramReads(code).filter((name) => captured.includes(name));
    assert.deepEqual(late, [], `${relative(root, path)}: a worklet parameter reads ${late.join(", ")} before the UI thread has it`);
  }
}
assert.ok(count >= 5, `found the app's worklets (${count})`);

// Run the swipe worklets the UI-thread way: a fresh context holding only what they captured.
const exported = settle as unknown as Record<string, unknown>;
function onUiThread<T extends (...args: never[]) => unknown>(name: string): T {
  const code = workletCodes(join(root, "swipe-settle.ts")).find((c) => c.includes(`function ${name}_`));
  assert.ok(code, `${name} is a worklet`);
  const fn = runInNewContext(code) as (...args: unknown[]) => unknown;
  const closure = closureNames(code).map((n) => exported[n]);
  return ((...args: unknown[]) => fn.apply({ __closure: closure }, args)) as T;
}
const drag = onUiThread<typeof settle.swipeDrag>("swipeDrag");
const rest = onUiThread<typeof settle.swipeSettle>("swipeSettle");
const shown = onUiThread<typeof settle.swipeActionShown>("swipeActionShown");
const W = settle.SWIPE_WIDTH;
assert.equal(drag(0, -300), -W, "drag on the UI thread");
assert.equal(drag(-W, 20), -W + 20);
assert.equal(rest(-W / 2 - 1, 0), -W, "settle on the UI thread");
assert.equal(rest(-20, -800), -W);
assert.equal(rest(-10, 0), 0);
assert.equal(shown(-5), true);
assert.equal(drag(0, -500, W, 360), -360, "full swipe drag on the UI thread");
assert.equal(rest(-300, 0, W, 360), -360, "full swipe deletes on the UI thread");
assert.equal(rest(-150, 0, W, 360), -W);

console.log(`worklets ui thread ok (${count} worklets)`);
