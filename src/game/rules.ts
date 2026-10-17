export type Platform = "A" | "B" | "C";
export type Route = "AB" | "BC" | null;
export type Phase =
  | "idle"
  | "forming"
  | "ready"
  | "walking"
  | "ending"
  | "complete";
export const ANGLES = { AB: -60, BC: 60 } as const;
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export function routeAt(angle: number): Route {
  return Math.abs(angle + 60) <= 9
    ? "AB"
    : Math.abs(angle - 60) <= 9
      ? "BC"
      : null;
}
/** Sole authority for permission, ice and travel; rendering cannot change topology. */
export class WorldRules {
  platform: Platform = "A";
  phase: Phase = "idle";
  angle = 0;
  route: Route = null;
  desired: Route = null;
  candidate: Route = null;
  ab = 0;
  bc = 0;
  dwell = 0;
  travel = 0;
  endTime = 0;
  changes = 0;
  elapsed = 0;
  get locked() {
    return ["walking", "ending", "complete"].includes(this.phase);
  }
  get canWalk() {
    return (
      this.phase === "ready" &&
      routeAt(this.angle) === this.route &&
      ((this.platform === "A" && this.route === "AB") ||
        (this.platform === "B" && this.route === "BC"))
    );
  }
  rotate(angle: number) {
    if (!this.locked) this.angle = clamp(angle, -80, 80);
  }
  confirm() {
    if (!this.canWalk) return false;
    this.phase = "walking";
    this.travel = 0;
    return true;
  }
  reset() {
    Object.assign(this, new WorldRules());
  }
  update(rawDt: number) {
    const dt = clamp(rawDt, 0, 0.1);
    this.elapsed += dt;
    if (this.phase === "walking") {
      this.travel = Math.min(1, this.travel + dt / 7.5);
      if (this.travel >= 1) {
        this.platform = this.platform === "A" ? "B" : "C";
        this.phase = this.platform === "C" ? "ending" : "ready";
      }
      return;
    }
    if (this.phase === "ending") {
      this.endTime += dt;
      if (this.endTime >= 5) this.phase = "complete";
      return;
    }
    if (this.phase === "complete") return;
    const next = routeAt(this.angle);
    if (next !== this.candidate) {
      this.candidate = next;
      this.dwell = 0;
    } else this.dwell += dt;
    if (this.dwell >= 0.45 && this.desired !== next) {
      this.desired = next;
      this.route = null;
      this.phase = "forming";
      this.changes++;
    }
    if (this.desired !== "AB") this.ab = Math.max(0, this.ab - dt / 0.95);
    if (this.desired !== "BC") this.bc = Math.max(0, this.bc - dt / 0.95);
    if (this.desired === "AB" && this.bc === 0)
      this.ab = Math.min(1, this.ab + dt / 2.4);
    if (this.desired === "BC" && this.ab === 0)
      this.bc = Math.min(1, this.bc + dt / 2.4);
    if (
      (this.desired === "AB" && this.ab === 1) ||
      (this.desired === "BC" && this.bc === 1)
    ) {
      this.route = this.desired;
      this.phase = "ready";
    } else if (this.ab === 0 && this.bc === 0 && this.desired === null) {
      this.route = null;
      this.phase = "idle";
    }
  }
}
