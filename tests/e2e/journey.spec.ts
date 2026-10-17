import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
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
    if (
      !route
        .request()
        .url()
        .startsWith(test.info().project.use.baseURL as string)
    ) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("./");
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
  // Actual canvas drags; no injected rules, travel state, clocks or topology.
  const route = [
    { from:"A", to:"L", mechanism:"axis", angle:-56, edge:"AL" },
    { from:"L", to:"B", mechanism:"stairs", angle:34, edge:"LB" },
    { from:"B", to:"U", mechanism:"axis", angle:52, edge:"BU" },
    { from:"U", to:"B2", mechanism:"crown", angle:-38, edge:"UB2" },
    { from:"B2", to:"C", mechanism:"axis", angle:-22, edge:"B2C" },
  ];
  async function dragTo(angle:number,mechanism:string) {
    const config=JSON.parse((await page.locator("#app").getAttribute("data-configuration"))!);
    const delta=(angle-config[mechanism])/.3;
    await page.mouse.move(850,620);await page.mouse.down();
    await page.mouse.move(850+delta,620,{steps:8});await page.mouse.up();
  }
  for(const [i,step] of route.entries()) {
    await expect(page.locator("#app")).toHaveAttribute("data-mechanism",step.mechanism);
    const falseAngle=step.from==="L"?-34:step.from==="B"?18:null;
    if(falseAngle!==null) {
      await dragTo(falseAngle,step.mechanism);
      await expect(page.locator("#confirm")).toBeDisabled();
      await expect.poll(async()=>{
        const a=JSON.parse((await page.locator("#app").getAttribute("data-alignment"))!);
        return a.find((x:{id:string})=>x.id===(step.from==="L"?"fold":"echo"))?.reason;
      }).toBe(step.from==="L"?"direction":"unreachable");
      await page.locator("#world").focus();await page.keyboard.press("Enter");
      await expect(page.locator("#app")).toHaveAttribute("data-platform",step.from);
    }
    await dragTo(step.angle,step.mechanism);
    await expect(page.locator("#confirm")).toBeEnabled({timeout:25000});
    await expect(page.locator("#app")).toHaveAttribute("data-route",step.edge);
    await page.screenshot({path:`test-results/v2-${i+1}-${step.edge}.png`});
    await page.locator("#confirm").click();
    await expect(page.locator("#rotation")).toBeDisabled();
    await page.mouse.move(800,600);await page.mouse.down();await page.mouse.move(1100,600);await page.mouse.up();
    await expect(page.locator("#app")).toHaveAttribute("data-platform",step.to,{timeout:40000});
    await expect(page.locator("#app")).toHaveAttribute("data-crossings",String(i+1));
  }
  await expect(page.locator("#ending")).toBeVisible({ timeout: 40000 });
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "C");
  await page.screenshot({ path: "test-results/04-ending.png" });
  await page.locator("#again").click();
  await expect(page.locator("#app")).toHaveAttribute("data-platform", "A");
  await expect(page.locator("#app")).toHaveAttribute("data-route", "none");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test("packaged vision files stay under the deployment path with correct bytes and MIME types", async ({
  request,
}) => {
  const expected =
    "94cae88157602cec45e48fe0c572b418a9641a9aae977ffd71dddbce167201a1";
  const model = await request.get("vision/hand_landmarker.task");
  expect(model.status()).toBe(200);
  expect(
    createHash("sha256")
      .update(await model.body())
      .digest("hex"),
  ).toBe(expected);
  for (const variant of ["internal", "module_internal", "nosimd_internal"]) {
    for (const ext of ["js", "wasm"]) {
      const response = await request.get(
        `vision/wasm/vision_wasm_${variant}.${ext}`,
      );
      expect(response.status()).toBe(200);
      expect((await response.body()).length).toBeGreaterThan(10000);
      expect(response.headers()["content-type"]).toContain(
        ext === "wasm" ? "application/wasm" : "javascript",
      );
    }
  }
});
test("real local MediaPipe initializes and infers on a synthetic camera stream", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
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
