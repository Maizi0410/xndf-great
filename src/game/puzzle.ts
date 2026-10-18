import * as T from "three";

export type NodeId = "A" | "L" | "B" | "U" | "B2" | "C";
export type Mechanism = "axis" | "stairs" | "crown";
export type Configuration = Record<Mechanism, number>;
export const INITIAL: Configuration = { axis: 0, stairs: -12, crown: 8 };
export const VIEW_FROM = new T.Vector3(20, 23, 27);
export const VIEW_TARGET = new T.Vector3(0, .5, -.5);
export const VIEW_RAY = VIEW_FROM.clone().sub(VIEW_TARGET).normalize();
export const NODES: Record<NodeId, T.Vector3> = {
  A: new T.Vector3(-6, 1.3, 3),
  L: new T.Vector3(-5.8, 3.15, -2.3),
  B: new T.Vector3(0, 1.3, 0),
  U: new T.Vector3(2.8, 3.1, 2.4),
  B2: new T.Vector3(0, 4.1, -.4),
  C: new T.Vector3(4.8, 1.3, -6.8),
};
export const NODE_LABELS: Record<NodeId, string> = {
  A: "I · 起点", L: "悬阶 · 西", B: "II · 中庭", U: "回廊 · 东", B2: "II · 上庭", C: "III · 门",
};
export const ACTIVE: Record<NodeId, Mechanism> = {
  A: "axis", L: "stairs", B: "axis", U: "crown", B2: "axis", C: "axis",
};
export const MECHANISM_LABELS: Record<Mechanism, string> = {
  axis: "中央回转轴", stairs: "西侧折叠阶", crown: "高处回廊",
};
export interface Connection {
  id: string;
  from: NodeId;
  to: NodeId;
  controls: Partial<Configuration>;
  depth: number;
  title: string;
  decoy?: "direction" | "disconnected";
}
// Shared axis is reused three times. The stairs/crown retain their orientation:
// the final topology depends on the whole configuration, not a chapter counter.
export const CONNECTIONS: Connection[] = [
  { id: "AL", from: "A", to: "L", controls: { axis: -56 }, depth: 1.8, title: "借来的高度" },
  { id: "LB", from: "L", to: "B", controls: { axis: -56, stairs: 34 }, depth: -1.6, title: "折回中庭" },
  { id: "BU", from: "B", to: "U", controls: { axis: 52, stairs: 34 }, depth: 1.6, title: "失去归路" },
  { id: "UB2", from: "U", to: "B2", controls: { axis: 52, crown: -38 }, depth: -1.8, title: "另一面中庭" },
  { id: "B2C", from: "B2", to: "C", controls: { axis: -22, stairs: 34, crown: -38 }, depth: 2, title: "最后的许可" },
  // A folded-back end meets in position but contradicts the travel direction.
  { id: "fold", from: "L", to: "B", controls: { axis: -56, stairs: -34 }, depth: -1.6, title: "反向的阶", decoy: "direction" },
  // A convincing remote connection has no access from the current safe node.
  { id: "echo", from: "U", to: "C", controls: { axis: 18, crown: 8 }, depth: 1.5, title: "远处的回声", decoy: "disconnected" },
];
export const OUTGOING = Object.fromEntries(CONNECTIONS.filter(c => !c.decoy).map(c => [c.from, c])) as Partial<Record<NodeId, Connection>>;
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export function createPuzzleCamera(aspect = 1.44) {
  const camera = new T.OrthographicCamera(-11.4 * aspect - 3.3, 11.4 * aspect - 3.3, 11.4, -11.4, .1, 150);
  camera.position.copy(VIEW_FROM);
  camera.lookAt(VIEW_TARGET);
  camera.updateMatrixWorld(true);
  return camera;
}
export interface Half { anchor: T.Vector3; tip: T.Vector3; rotation: number; bend?: T.Vector3 }
export interface BridgePose { left: Half; right: Half }
export function bridgePose(c: Connection, config: Configuration): BridgePose {
  const a = NODES[c.from].clone(), b = NODES[c.to];
  if (c.decoy === "disconnected") a.add(new T.Vector3(1.7,0,1.7));
  const mid = a.clone().lerp(b, .5);
  const near = mid.clone().addScaledVector(VIEW_RAY, -c.depth / 2);
  const far = mid.clone().addScaledVector(VIEW_RAY, c.depth / 2);
  const controls = Object.entries(c.controls) as [Mechanism, number][];
  const first = controls[0];
  const rest = controls.slice(1);
  const leftRotation = T.MathUtils.degToRad((config[first[0]] - first[1]) * .85);
  const rightRotation = T.MathUtils.degToRad(rest.reduce((d, [k,v]) => d + (config[k] - v), 0) * -.95);
  const rotate = (point: T.Vector3, pivot: T.Vector3, angle: number) => point.clone().sub(pivot).applyAxisAngle(T.Object3D.DEFAULT_UP, angle).add(pivot);
  return {
    left: { anchor: a.clone(), tip: rotate(near, a, leftRotation), rotation: leftRotation },
    right: { anchor: b.clone(), tip: rotate(far, b, rightRotation), rotation: rightRotation, bend: c.decoy === "direction" ? rotate(far.clone().sub(b.clone().sub(far).multiplyScalar(.3)).add(b.clone().sub(far).cross(T.Object3D.DEFAULT_UP).normalize().multiplyScalar(.65)), b, rightRotation) : undefined },
  };
}
export type RejectReason = "gap" | "direction" | "occluded" | "configuration" | "unreachable" | "aligned";
export interface Alignment {
  id: string; legal: boolean; reason: RejectReason; distance: number; continuity: number; proximity: number;
}
export function screenPoint(p: T.Vector3, camera: T.Camera, width: number, height: number) {
  const q = p.clone().project(camera);
  return new T.Vector2((q.x + 1) * width / 2, (1 - q.y) * height / 2);
}
/** Uses exactly the current renderer's camera, viewport and world endpoints. */
export function assessConnection(c: Connection, pose: BridgePose, config: Configuration, node: NodeId, camera: T.Camera, width: number, height: number, blockers: T.Object3D[] = []): Alignment {
  camera.updateMatrixWorld(true);
  const project = (p: T.Vector3) => screenPoint(p, camera, width, height);
  const a = project(pose.left.tip), b = project(pose.right.tip);
  const incoming = a.clone().sub(project(pose.left.anchor)).normalize();
  const outgoing = project(pose.right.bend ?? pose.right.anchor).sub(b).normalize();
  // The decoy physically returns toward its seam rather than continuing forward.
  const continuity = incoming.dot(outgoing);
  const distance = a.distanceTo(b);
  const scale = project(NODES.B.clone().add(new T.Vector3(1,0,0))).distanceTo(project(NODES.B));
  const tolerance = Math.max(1e-6, scale * .19);
  const proximity = clamp(1 - distance / (tolerance * 7), 0, 1);
  const permitted = Object.entries(c.controls).every(([k,v]) => Math.abs(config[k as Mechanism] - v!) <= 8);
  let reason: RejectReason = distance > tolerance ? "gap" : continuity < .86 ? "direction" : !permitted ? "configuration" : c.from !== node || pose.left.anchor.distanceTo(NODES[node]) > .65 ? "unreachable" : "aligned";
  // Sample the torso corridor against actual architectural blockers. Floors,
  // bridge treads and wires are excluded, so they cannot falsely block themselves.
  if (reason === "aligned" && blockers.length) {
    const ray = new T.Raycaster();
    for (const half of [pose.left, pose.right]) {
      for (const t of [.35, .7, 1]) {
        const p = half.anchor.clone().lerp(half.tip,t).add(new T.Vector3(0,.45,0));
        const ndc = p.clone().project(camera);
        ray.setFromCamera(new T.Vector2(ndc.x,ndc.y),camera);
        const depth = p.clone().sub(ray.ray.origin).dot(ray.ray.direction);
        if (ray.intersectObjects(blockers,true).some(hit => hit.distance < depth - .15)) reason = "occluded";
      }
    }
  }
  return { id: c.id, legal: reason === "aligned", reason, distance, continuity, proximity };
}
export function evaluate(config: Configuration, node: NodeId, camera: T.Camera, width: number, height: number, blockers: T.Object3D[] = []) {
  return CONNECTIONS.map(c => assessConnection(c, bridgePose(c,config),config,node,camera,width,height,blockers));
}
/** Continuous depth transfer along an orthographic viewing ray. Both seams
 * have identical projection but distinct world heights and positions. The short
 * interpolation never teleports, changes scale, or changes camera orientation. */
export function travelPoint(c: Connection, pose: BridgePose, progress: number) {
  const t = clamp(progress,0,1);
  const ease = t < .08 ? t*t/.16 : t > .92 ? .92-(1-t)*(1-t)/.16 : t-.04;
  const u = ease/.92;
  const near = pose.left.tip, far = pose.right.tip;
  const tangent = pose.right.anchor.clone().sub(pose.left.anchor).normalize().multiplyScalar(.13);
  const entry = near.clone().sub(tangent), exit = far.clone().add(tangent);
  if (u < .47) return pose.left.anchor.clone().lerp(entry,u/.47);
  if (u <= .53) return entry.clone().lerp(exit,(u-.47)/.06);
  return exit.clone().lerp(pose.right.anchor,(u-.53)/.47);
}
