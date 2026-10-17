// Tests the existing game with all HTTP(S)/WebSocket requests blocked.
// Synthetic video checks local inference only, never actual camera hardware.
import { _electron as electron, expect } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
const require = createRequire(import.meta.url);
const packaged = process.env.PERMITTED_PACKAGED === "1";
const executablePath = packaged
  ? path.resolve(
      process.env.PERMITTED_APP_PATH ??
        "release-classroom/mac-arm64/The Permitted World.app/Contents/MacOS/The Permitted World",
    )
  : require("electron");
const runtime = await mkdtemp(path.join(os.tmpdir(), "permitted-offline-"));
let application;
try {
  application = await electron.launch({
    executablePath,
    env: {
      ...process.env,
      ...(process.platform === "linux"
        ? {
            XDG_CACHE_HOME: path.join(runtime, "cache"),
            XDG_CONFIG_HOME: path.join(runtime, "config"),
          }
        : {}),
    },
    args: packaged
      ? []
      : [
          ...(process.platform === "linux"
            ? [
                "--no-sandbox",
                "--ozone-platform=headless",
                "--enable-unsafe-swiftshader",
                "--use-angle=swiftshader",
              ]
            : []),
          ".",
        ],
    timeout: 45000,
  });
  await application.evaluate(({ session, systemPreferences }) => {
    globalThis.classroomBlockedRequests = [];
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (details, callback) => {
        globalThis.classroomBlockedRequests.push(details.url);
        callback({ cancel: true });
      },
    );
    // The test never opens the system camera; allow only the mocked OS response.
    systemPreferences.askForMediaAccess = async () => true;
  });
  const window = await application.firstWindow();
  const errors = [];
  window.on("pageerror", (e) => errors.push(e.message));
  await window.waitForURL("permitted://world/");
  await window.waitForLoadState("load");
  await expect(window.locator("#begin")).toBeVisible({ timeout: 20000 });
  await window.reload();
  await window.waitForLoadState("domcontentloaded");
  await expect(window.locator("#begin")).toBeVisible({ timeout: 20000 });
  await expect(window.locator("#fatal")).toBeHidden();
  await window.locator("#begin").click();
  await expect(window.locator("#app")).toHaveAttribute("data-platform", "A");
  await window.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 640, 480);
    const stream = c.captureStream(10);
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => stream,
    });
  });
  await window.locator("#camera-toggle").click();
  await expect(window.locator("#camera-status")).toHaveText(
    "未检测到手 · 输入已冻结",
    { timeout: 45000 },
  );
  await window.locator("#camera-stop").click();
  async function selectRoad(angle) {
    const slider = window.locator("#rotation");
    await expect(slider).toBeEnabled();
    const b = await slider.boundingBox();
    if (!b) throw new Error("Missing rotation slider");
    await window.mouse.click(
      b.x + 4.5 + ((b.width - 9) * (angle + 80)) / 160,
      b.y + b.height / 2,
    );
    await expect(window.locator("#confirm")).toBeEnabled({ timeout: 25000 });
  }
  for(const [angle,node] of [[-56,"L"],[34,"B"],[52,"U"],[-38,"B2"],[-22,"C"]]) {
    await selectRoad(angle);
    await window.locator("#confirm").click();
    await expect(window.locator("#rotation")).toBeDisabled();
    await expect(window.locator("#app")).toHaveAttribute("data-platform",node,{timeout:45000});
  }
  await expect(window.locator("#ending")).toBeVisible({timeout:20000});
  await expect(window.locator("#app")).toHaveAttribute("data-crossings","5");
  const blocked = await application.evaluate(
    () => globalThis.classroomBlockedRequests,
  );
  expect(blocked).toEqual([]);
  expect(errors).toEqual([]);
  await mkdir("test-results", { recursive: true });
  await window.screenshot({
    path: "test-results/classroom-offline-ending.png",
  });
  const report = {
    host: process.platform,
    arch: process.arch,
    target: packaged
      ? "packaged application"
      : "development Electron with production dist",
    network: "HTTP, HTTPS and WebSocket blocked before page reload",
    externalRequests: blocked.length,
    mouseJourney: "A→L→B→U→B2→C, five projection crossings and ending passed",
    localModelInference: "synthetic video passed",
    physicalCamera: "not tested",
    physicalMac: "not tested by this automated check",
  };
  await writeFile(
    "test-results/classroom-offline.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  try {
    await application?.close();
  } finally {
    await rm(runtime, { recursive: true, force: true });
  }
}
