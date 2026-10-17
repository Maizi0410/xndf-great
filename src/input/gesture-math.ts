export type Landmark = { x: number; y: number; z: number };
const distance = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function readHand(p: Landmark[]) {
  const scale = distance(p[0], p[9]);
  if (scale < 0.015) return null;
  return {
    x: 1 - p[9].x,
    pinch: distance(p[4], p[8]) / scale,
    open:
      [8, 12, 16, 20].filter(
        (t) => distance(p[t], p[0]) > distance(p[t - 2], p[0]) * 1.18,
      ).length >= 3,
  };
}
export class GestureFilter {
  x: number | null = null;
  pinched = false;
  held = 0;
  openTime = 0;
  lost() {
    this.x = null;
    this.held = 0;
    this.openTime = 0;
  }
  sample(hand: { x: number; pinch: number; open: boolean }, dt: number) {
    this.x =
      this.x === null
        ? hand.x
        : this.x + (hand.x - this.x) * (1 - Math.exp(-dt * 9));
    if (hand.pinch > 0.52) {
      this.pinched = false;
      this.held = 0;
    }
    let confirm = false;
    if (hand.pinch < 0.32 && !this.pinched) {
      this.held += dt;
      if (this.held > 0.16) {
        this.pinched = true;
        confirm = true;
      }
    } else if (hand.pinch >= 0.32) this.held = 0;
    this.openTime = hand.open ? this.openTime + dt : 0;
    return {
      x: this.x,
      rotate: this.openTime > 0.22 && !this.pinched,
      confirm,
    };
  }
}
