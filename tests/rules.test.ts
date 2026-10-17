import { describe, it, expect } from "vitest";
import { WorldRules, routeAt } from "../src/game/rules";
const advance = (r: WorldRules, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) r.update(1 / 60);
};
describe("permission topology", () => {
  it("starts without a road and rejects walking on water", () => {
    const r = new WorldRules();
    expect(r.confirm()).toBe(false);
    advance(r, 5);
    expect(r.ab + r.bc).toBe(0);
    expect(r.platform).toBe("A");
  });
  it("requires a stable legal angle and a fully formed road", () => {
    const r = new WorldRules();
    r.rotate(-60);
    advance(r, 0.3);
    expect(r.desired).toBe(null);
    expect(r.confirm()).toBe(false);
    advance(r, 1);
    expect(r.phase).toBe("forming");
    expect(r.confirm()).toBe(false);
    advance(r, 2);
    expect(r.canWalk).toBe(true);
  });
  it("allows a complete A → B → C journey and locks all input in transit", () => {
    const r = new WorldRules();
    r.rotate(-60);
    advance(r, 4);
    expect(r.confirm()).toBe(true);
    expect(r.confirm()).toBe(false);
    for (let i = 0; i < 450; i++) {
      r.rotate(60);
      r.update(1 / 60);
      expect(r.angle).toBe(-60);
      expect(r.ab).toBe(1);
      expect(r.bc).toBe(0);
    }
    advance(r, 0.2);
    expect(r.platform).toBe("B");
    expect(r.confirm()).toBe(false);
    r.rotate(60);
    advance(r, 5);
    expect(r.confirm()).toBe(true);
    advance(r, 8);
    expect(r.platform).toBe("C");
    advance(r, 6);
    expect(r.phase).toBe("complete");
  });
  it("melts the old road entirely before creating the next", () => {
    const r = new WorldRules();
    r.rotate(-60);
    advance(r, 4);
    r.rotate(60);
    for (let i = 0; i < 300; i++) {
      r.update(1 / 60);
      expect(r.ab === 0 || r.bc === 0).toBe(true);
    }
    expect(r.ab).toBe(0);
    expect(r.bc).toBe(1);
    expect(r.canWalk).toBe(false);
  });
  it("removes permission in the neutral state and resets all progress", () => {
    const r = new WorldRules();
    r.rotate(-60);
    advance(r, 4);
    r.rotate(0);
    advance(r, 3);
    expect(r.route).toBe(null);
    expect(r.ab + r.bc).toBe(0);
    r.rotate(-60);
    advance(r, 4);
    r.confirm();
    advance(r, 2);
    r.reset();
    expect(r).toEqual(new WorldRules());
  });
  it("preserves exclusivity through rapid arbitrary rotations", () => {
    const r = new WorldRules();
    let seed = 123;
    for (let i = 0; i < 12000; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      if (i % 35 === 0) r.rotate((seed % 161) - 80);
      r.update(0.016);
      expect(r.ab === 0 || r.bc === 0).toBe(true);
      expect(r.ab).toBeGreaterThanOrEqual(0);
      expect(r.bc).toBeLessThanOrEqual(1);
      if (r.route === "AB") expect(r.ab).toBe(1);
      if (r.route === "BC") expect(r.bc).toBe(1);
    }
  });
  it("immediately prevents confirmation after leaving a legal angle", () => {
    const r = new WorldRules();
    r.rotate(-60);
    advance(r, 4);
    r.rotate(0);
    expect(r.confirm()).toBe(false);
  });
  it("maps only the two legal orientation windows", () => {
    expect(routeAt(-60)).toBe("AB");
    expect(routeAt(60)).toBe("BC");
    expect(routeAt(0)).toBe(null);
    expect(routeAt(-49)).toBe(null);
  });
});
