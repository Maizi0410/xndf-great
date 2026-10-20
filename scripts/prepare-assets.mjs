import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
await mkdir("public/vision/wasm", { recursive: true });
await cp("node_modules/@mediapipe/tasks-vision/wasm", "public/vision/wasm", {
  recursive: true,
});
// The committed local task contains verified Google models with input metadata.
const expected =
  "94cae88157602cec45e48fe0c572b418a9641a9aae977ffd71dddbce167201a1";
const task = await readFile("public/vision/hand_landmarker.task");
if (createHash("sha256").update(task).digest("hex") !== expected)
  throw new Error("Committed hand model checksum mismatch");
const crc = (b) => {
  let c = 0xffffffff;
  for (const v of b) {
    c ^= v;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
// Original 512px application icon, lossless PNG; no runtime drawing dependencies.
const n = 512,
  raw = Buffer.alloc((n * 4 + 1) * n);
for (let y = 0; y < n; y++)
  for (let x = 0; x < n; x++) {
    const i = y * (n * 4 + 1) + 1 + x * 4;
    let rgb = [15, 34, 46];
    const frame =
      (((x > 124 && x < 157) || (x > 355 && x < 388)) && y > 98 && y < 404) ||
      (y > 98 && y < 130 && x > 124 && x < 388);
    if (frame) rgb = [155, 178, 183];
    if (x > 225 && x < 287 && y > 234 && y < 393) rgb = [225, 185, 119];
    if (y > 407 && y < 415 && x > 77 && x < 435) rgb = [77, 112, 127];
    raw[i] = rgb[0];
    raw[i + 1] = rgb[1];
    raw[i + 2] = rgb[2];
    raw[i + 3] = 255;
  }
function chunk(type, data) {
  const t = Buffer.from(type),
    len = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, sum]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(n);
header.writeUInt32BE(n, 4);
header[8] = 8;
header[9] = 6;
await mkdir("build", { recursive: true });
await writeFile(
  "build/icon.png",
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
console.log("Local WASM, model SHA-256 and icon verified.");

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const source = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim();
await writeFile("public/build-info.json", JSON.stringify({version:pkg.version,source_commit:source})+"\n");

// The WAV is an archival master outside public/, never a web/app payload.
const music = JSON.parse(await readFile("public/audio/bgm_exploration.json", "utf8"));
for (const [file, checksum] of [[music.master, music.master_sha256], ["public/audio/" + music.playback, music.playback_sha256]]) {
  if (createHash("sha256").update(await readFile(file)).digest("hex") !== checksum) throw new Error("Music checksum mismatch: " + file);
}
console.log("Original WAV master and compressed exploration music verified.");
