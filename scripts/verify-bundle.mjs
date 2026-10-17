import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url),
  asar = require("@electron/asar");
export async function verifyBundle(
  base = "release/mac-arm64/The Permitted World.app/Contents",
) {
  const executable = await readFile(`${base}/MacOS/The Permitted World`);
  if (
    executable.readUInt32LE(0) !== 0xfeedfacf ||
    executable.readUInt32LE(4) !== 0x0100000c
  )
    throw new Error("Expected a thin ARM64 Mach-O executable");
  const archive = `${base}/Resources/app.asar`,
    entries = new Set(asar.listPackage(archive));
  const required = [
    "dist/index.html",
    "dist/vision/manifest.json",
    "dist/vision/hand_landmarker.task",
    "electron/main.cjs",
    "electron/preload.cjs",
  ];
  for (const variant of ["internal", "module_internal", "nosimd_internal"])
    for (const ext of ["js", "wasm"])
      required.push(`dist/vision/wasm/vision_wasm_${variant}.${ext}`);
  for (const name of required)
    if (!entries.has("/" + name))
      throw new Error("Missing ASAR resource: " + name);
  const model = asar.extractFile(archive, "dist/vision/hand_landmarker.task");
  if (
    createHash("sha256").update(model).digest("hex") !==
    "94cae88157602cec45e48fe0c572b418a9641a9aae977ffd71dddbce167201a1"
  )
    throw new Error("Packaged model SHA-256 mismatch");
  const html = asar.extractFile(archive, "dist/index.html").toString();
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^\"]+)"/g)];
  if (assets.length < 2)
    throw new Error("Missing relative script and style paths");
  for (const [, name] of assets)
    if (!entries.has("/dist/" + name.slice(2)))
      throw new Error("Missing built HTML dependency: " + name);
  const plist = await readFile(`${base}/Info.plist`, "utf8");
  if (
    !plist.includes("NSCameraUsageDescription") ||
    !plist.includes("art.permittedworld.game")
  )
    throw new Error("Missing bundle ID / camera description");
  return {
    architecture: "arm64",
    offlineResources: "passed",
    modelSHA256: "passed",
    htmlDependencies: "passed",
    cameraDescription: "present",
    asarEntries: entries.size,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(JSON.stringify(await verifyBundle(), null, 2));
