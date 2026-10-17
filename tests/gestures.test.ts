import { it, expect } from "vitest";
import { GestureFilter, readHand } from "../src/input/gesture-math";
it("debounces a held pinch, requires release, and rejects momentary noise", () => {
  const f = new GestureFilter();
  let confirmations = 0;
  for (let i = 0; i < 50; i++)
    if (f.sample({ x: 0.5, pinch: 0.2, open: false }, 0.04).confirm)
      confirmations++;
  expect(confirmations).toBe(1);
  f.sample({ x: 0.5, pinch: 0.7, open: true }, 0.04);
  expect(f.sample({ x: 0.5, pinch: 0.2, open: false }, 0.04).confirm).toBe(
    false,
  );
  for (let i = 0; i < 10; i++)
    if (f.sample({ x: 0.5, pinch: 0.2, open: false }, 0.04).confirm)
      confirmations++;
  expect(confirmations).toBe(2);
});
it("freezes on loss without rearming a held pinch and reacquires without interpolation jumps", () => {
  const f = new GestureFilter();
  for (let i = 0; i < 8; i++)
    f.sample({ x: 0.2, pinch: 0.2, open: false }, 0.04);
  f.lost();
  const a = f.sample({ x: 0.9, pinch: 0.2, open: false }, 0.04);
  expect(a.x).toBe(0.9);
  expect(a.confirm).toBe(false);
  expect(a.rotate).toBe(false);
});
it("requires a stable open palm and smooths displacement", () => {
  const f = new GestureFilter();
  expect(f.sample({ x: 0.2, pinch: 0.7, open: true }, 0.04).rotate).toBe(false);
  let a;
  for (let i = 0; i < 8; i++)
    a = f.sample({ x: 0.8, pinch: 0.7, open: true }, 0.04);
  expect(a!.rotate).toBe(true);
  expect(a!.x).toBeLessThan(0.8);
  expect(a!.x).toBeGreaterThan(0.2);
});
it("normalizes pinch by hand size and rejects degenerate landmarks", () => {
  const p = Array.from({ length: 21 }, (_, i) => ({
    x: i * 0.01,
    y: i * 0.02,
    z: 0,
  }));
  const a = readHand(p)!;
  const b = readHand(p.map((v) => ({ x: v.x * 2, y: v.y * 2, z: 0 })))!;
  expect(a.pinch).toBeCloseTo(b.pinch);
  expect(readHand(p.map(() => ({ x: 0, y: 0, z: 0 })))).toBe(null);
});
