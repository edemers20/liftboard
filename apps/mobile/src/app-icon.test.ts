import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// iOS shows the installed app icon on the rest alert; there is no per-notification icon.
// A clean prebuild copies these three files into AppIcon.appiconset.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo;
const icons = config.ios.icon as Record<string, string>;

for (const look of ["light", "dark", "tinted"]) {
  const path = join(root, icons[look]);
  assert.ok(existsSync(path), `${look} icon exists: ${icons[look]}`);
  const png = readFileSync(path);
  assert.equal(png.readUInt32BE(16), 1024, `${look} icon is 1024 wide`);
  assert.equal(png.readUInt32BE(20), 1024, `${look} icon is 1024 tall`);
  assert.equal(png[25], 2, `${look} icon is RGB with no alpha`);
}
assert.equal(config.icon, icons.light, "the top-level icon is the same light icon");
assert.ok(!existsSync(join(root, "assets/expo.icon")), "the old Expo template icon stays removed");

console.log("app-icon ok");
