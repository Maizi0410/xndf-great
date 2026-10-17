import { _electron as electron, expect } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const packaged = process.env.PERMITTED_PACKAGED === "1";
const executablePath = packaged
  ? path.resolve(
      "release/mac-arm64/The Permitted World.app/Contents/MacOS/The Permitted World",
    )
  : require("electron");
const application = await electron.launch({
  executablePath,
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
try {
  const window = await application.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  await expect(window.locator("#begin")).toBeVisible();
  await expect(window.locator("#fatal")).toBeHidden();
  const security = await window.evaluate(() => ({
    url: location.href,
    secure: isSecureContext,
    node: typeof globalThis.process,
    api: Object.keys(globalThis.desktop ?? {}),
  }));
  expect(security).toEqual({
    url: "permitted://world/",
    secure: true,
    node: "undefined",
    api: ["requestCamera"],
  });
  for (const asset of [
    "vision/manifest.json",
    "vision/hand_landmarker.task",
    "vision/wasm/vision_wasm_internal.wasm",
  ]) {
    const result = await window.evaluate(async (asset) => {
      const r = await fetch(asset);
      return { status: r.status, length: (await r.arrayBuffer()).byteLength };
    }, asset);
    expect(result.status).toBe(200);
    expect(result.length).toBeGreaterThan(100);
  }
  await window.locator("#begin").click();
  await expect(window.locator("#app")).toHaveAttribute("data-platform", "A");
  // Simulate OS authorization and camera frames; never claim hardware validation.
  await application.evaluate(({ systemPreferences }) => {
    systemPreferences.askForMediaAccess = async () => true;
  });
  await window.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 640, 480);
    const stream = canvas.captureStream(10);
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
  await window.screenshot({ path: "test-results/electron-startup.png" });
  console.log(
    "Electron secure local origin, isolated preload, UI, local vision assets and synthetic-frame inference: passed",
  );
} finally {
  await application.close();
}
