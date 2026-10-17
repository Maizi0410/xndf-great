import { test, expect } from "@playwright/test";
test("mouse completes the entire offline world, even after camera denial", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /THREE|GLSL|shader/i.test(m.text()))
      errors.push(m.text());
  });
  await context.route("**/*", (route) => {
    if (!route.request().url().startsWith("http://127.0.0.1:4173")) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await expect(page.locator("#fatal")).toBeHidden();
  await page.screenshot({ path: "test-results/01-title.png" });
  await page.getByRole("button", { name: "进入界限" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "A");
  await expect(page.locator("#confirm")).toBeDisabled();
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(
          new DOMException("Camera permission denied", "NotAllowedError"),
        ),
    });
  });
  await page.locator("#camera-toggle").click();
  await expect(page.locator("#camera-status")).toContainText(
    "摄像头权限未获准",
  );
  await page.locator("#camera-stop").click();
  // Real pointer gestures on the 3D view. No injected game-state transitions.
  await page.mouse.move(820, 650);
  await page.mouse.down();
  await page.mouse.move(620, 650, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("#confirm")).toBeEnabled({ timeout: 20000 });
  await page.screenshot({ path: "test-results/02-first-permission.png" });
  await page.locator("#confirm").click();
  await expect(page.locator("#rotation")).toBeDisabled();
  await page.mouse.move(750, 600);
  await page.mouse.down();
  await page.mouse.move(1150, 600, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "B", {
    timeout: 30000,
  });
  await expect(page.locator("#app")).toHaveAttribute("data-route", "AB");
  await page.mouse.move(700, 650);
  await page.mouse.down();
  await page.mouse.move(1100, 650, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator("#app")).toHaveAttribute("data-route", "BC", {
    timeout: 20000,
  });
  await page.screenshot({ path: "test-results/03-rewritten-boundary.png" });
  await page.locator("#confirm").click();
  await expect(page.locator("#ending")).toBeVisible({ timeout: 40000 });
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "C");
  await page.screenshot({ path: "test-results/04-ending.png" });
  await page.locator("#again").click();
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "A");
  await expect(page.locator("#app")).toHaveAttribute("data-route", "none");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("packaged vision files are local and complete", async ({ request }) => {
  for (const file of [
    "hand_landmarker.task",
    "wasm/vision_wasm_internal.wasm",
    "wasm/vision_wasm_internal.js",
  ]) {
    const r = await request.get("/vision/" + file);
    expect(r.status()).toBe(200);
    expect((await r.body()).length).toBeGreaterThan(10000);
  }
});
test("real local MediaPipe initializes and infers on a synthetic camera stream", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#begin").click();
  await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 640, 480);
    const stream = c.captureStream(10);
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => stream,
    });
  });
  await page.locator("#camera-toggle").click();
  await expect(page.locator("#camera-status")).toHaveText(
    "未检测到手 · 输入已冻结",
    { timeout: 40000 },
  );
  await expect(page.locator("#camera")).toHaveJSProperty("readyState", 4);
  await page.locator("#camera-stop").click();
  expect(errors).toEqual([]);
});
