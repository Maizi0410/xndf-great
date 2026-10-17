import { verifyBundle } from "./verify-bundle.mjs";
import { readdir, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
if (process.platform !== "darwin" || process.arch !== "arm64")
  throw new Error("Verification must run on a native ARM64 Mac.");
await verifyBundle();
const base = "release/mac-arm64/The Permitted World.app/Contents";
const info = execFileSync(
  "lipo",
  ["-archs", `${base}/MacOS/The Permitted World`],
  { encoding: "utf8" },
).trim();
if (info !== "arm64") throw new Error(`Wrong executable architecture: ${info}`);
const archive = `${base}/Resources/app.asar`;
const entries = asar.listPackage(archive);
for (const file of [
  "/dist/index.html",
  "/dist/vision/hand_landmarker.task",
  "/dist/vision/wasm/vision_wasm_internal.wasm",
  "/dist/vision/wasm/vision_wasm_internal.js",
  "/electron/main.cjs",
  "/electron/preload.cjs",
])
  if (!entries.includes(file))
    throw new Error(`Missing packaged resource: ${file}`);
const bytes = asar.extractFile(archive, "dist/vision/hand_landmarker.task");
if (
  createHash("sha256").update(bytes).digest("hex") !==
  "94cae88157602cec45e48fe0c572b418a9641a9aae977ffd71dddbce167201a1"
)
  throw new Error("Packaged model corrupted");
const html = asar.extractFile(archive, "dist/index.html").toString();
if (!html.includes("./assets/"))
  throw new Error("HTML asset paths are not relative");
const plist = execFileSync(
  "plutil",
  ["-convert", "json", "-o", "-", `${base}/Info.plist`],
  { encoding: "utf8" },
);
if (!JSON.parse(plist).NSCameraUsageDescription)
  throw new Error("Camera usage description missing");
const dmgs = (await readdir("release")).filter((x) => x.endsWith("arm64.dmg"));
if (dmgs.length !== 1) throw new Error("Expected exactly one ARM64 DMG");
execFileSync("hdiutil", ["verify", `release/${dmgs[0]}`], { stdio: "inherit" });
const dmg = await readFile(`release/${dmgs[0]}`);
console.log(
  JSON.stringify(
    {
      architecture: info,
      dmg: dmgs[0],
      size: (await stat(`release/${dmgs[0]}`)).size,
      sha256: createHash("sha256").update(dmg).digest("hex"),
      resourceChecks: "passed",
    },
    null,
    2,
  ),
);
