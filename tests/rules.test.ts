import { describe, it, expect } from "vitest";
import * as T from "three";
import { WorldRules } from "../src/game/rules";
import { ACTIVE, CONNECTIONS, INITIAL, NODES, bridgePose, createPuzzleCamera, evaluate, assessConnection, screenPoint, travelPoint, type Configuration, type NodeId } from "../src/game/puzzle";
const camera=createPuzzleCamera();
const solution:[NodeId,number,string][]=[["A",-56,"AL"],["L",34,"LB"],["B",52,"BU"],["U",-38,"UB2"],["B2",-22,"B2C"]];
function advance(r:WorldRules,seconds:number) {
 for(let i=0;i<Math.ceil(seconds*60);i++) {
  r.measure(evaluate(r.config,r.platform,camera,1440,1000));
  r.update(1/60);
 }
}
describe("V2 projected architecture",()=>{
 it.each([[1440,1000],[1920,1080],[768,1024],[390,844]])("aligns real depth-separated seams at %sx%s",(w,h)=>{
  const cam=createPuzzleCamera(w/h);
  for(const c of CONNECTIONS.filter(c=>!c.decoy)) {
   const config={...INITIAL,...c.controls};
   const pose=bridgePose(c,config);
   expect(pose.left.tip.distanceTo(pose.right.tip)).toBeGreaterThan(1.4);
   expect(assessConnection(c,pose,config,c.from,cam,w,h).legal).toBe(true);
   expect(screenPoint(pose.left.tip,cam,w,h).distanceTo(screenPoint(pose.right.tip,cam,w,h))).toBeLessThan(.0001);
  }
 });
 it("rejects an actual folded-back tread, wrong direction and unreachable remote seams",()=>{
  for(const c of CONNECTIONS.filter(c=>c.decoy)) {
   const config={...INITIAL,...c.controls};
   const a=assessConnection(c,bridgePose(c,config),config,"B",camera,1440,1000);
   expect(a.distance).toBeLessThan(.0001);
   expect(a.legal).toBe(false);
   expect(a.reason).toBe(c.decoy==="direction"?"direction":"unreachable");
  }
 });
 it("tests actual camera occlusion and projected direction, rather than an angle lookup",()=>{
  const c=CONNECTIONS[0],config={...INITIAL,...c.controls},pose=bridgePose(c,config);
  const wall=new T.Mesh(new T.BoxGeometry(2,3,2),new T.MeshBasicMaterial());
  wall.position.copy(pose.left.tip).addScaledVector(camera.position.clone().sub(NODES.B).normalize(),3);
  wall.updateMatrixWorld(true);
  expect(assessConnection(c,pose,config,"A",camera,1440,1000,[wall]).reason).toBe("occluded");
  const altered=bridgePose(c,config); altered.right.tip.x+=1;
  expect(assessConnection(c,altered,config,"A",camera,1440,1000).legal).toBe(false);
  const changedCamera=createPuzzleCamera(); changedCamera.position.x+=5;changedCamera.lookAt(0,.5,-.5);
  expect(assessConnection(c,pose,config,"A",changedCamera,1440,1000).legal).toBe(false);
 });
 it("transfers continuously across every depth gap with constant projected scale",()=>{
  for(const c of CONNECTIONS.filter(c=>!c.decoy)) {
   const config={...INITIAL,...c.controls},pose=bridgePose(c,config);
   let last=travelPoint(c,pose,0),lastScreen=screenPoint(last,camera,1440,1000);
   expect(last.distanceTo(NODES[c.from])).toBeLessThan(1e-9);
   for(let i=1;i<=2000;i++) {
    const point=travelPoint(c,pose,i/2000),screen=screenPoint(point,camera,1440,1000);
    expect(point.distanceTo(last)).toBeLessThan(.04);
    expect(screen.distanceTo(lastScreen)).toBeLessThan(.8);
    expect(point.y).toBeGreaterThan(.25);
    last=point;lastScreen=screen;
   }
   expect(last.distanceTo(NODES[c.to])).toBeLessThan(1e-9);
  }
 });
});
describe("V2 permission topology",()=>{
 it("requires five distinct crossings, retains combinations and locks rotation in transit",()=>{
  const r=new WorldRules();
  expect(r.confirm()).toBe(false);
  for(const [node,angle,id] of solution) {
   expect(r.platform).toBe(node);
   r.rotate(angle);advance(r,.3);expect(r.confirm()).toBe(false);
   advance(r,3.2);expect(r.route).toBe(id);expect(r.confirm()).toBe(true);
   expect(r.confirm()).toBe(false);
   const config={...r.config};
   for(let i=0;i<480;i++){r.rotate(0);advance(r,1/60);expect(r.config).toEqual(config);}
   advance(r,.1);
  }
  expect(r.platform).toBe("C");expect(r.traversed).toEqual(solution.map(s=>s[2]));
  expect(r.config).toEqual({axis:-22,stairs:34,crown:-38});
  advance(r,6);expect(r.phase).toBe("complete");
  r.reset();expect(r).toEqual(new WorldRules());
 });
 it("revokes permission synchronously and never lets old ice coexist with new permission",()=>{
  const r=new WorldRules();r.rotate(-56);advance(r,3);expect(r.canWalk).toBe(true);
  r.rotate(52);expect(r.confirm()).toBe(false);
  for(let i=0;i<360;i++){advance(r,1/60);expect(Object.values(r.growth).filter(g=>g>0).length).toBeLessThanOrEqual(1);}
  expect(r.canWalk).toBe(false);
 });
 it("can recover from any rotation at each safe node without an irreversible dead end",()=>{
  for(const [node,target] of solution) {
   for(let angle=-80;angle<=80;angle+=8) {
    const r=new WorldRules();r.platform=node;
    r.config={axis:node==="A"||node==="L"?-56:52,stairs:34,crown:-38};
    r.rotate(angle);advance(r,.1);r.rotate(target);advance(r,4);
    expect(r.canWalk,`${node}: recovery from ${angle}`).toBe(true);
   }
  }
 });
 it("cannot reach the exit by replaying V1's two angle changes or random confirmations",()=>{
  const r=new WorldRules();
  for(const angle of [-60,60,-60,60,0,18,-34,80]) {
   r.rotate(angle);advance(r,4);r.confirm();advance(r,9);
  }
  expect(r.platform).not.toBe("C");expect(r.traversed.length).toBeLessThan(5);
 });
 it("does not reset dwell for tiny hand movements inside the permitted corridor",()=>{
  const r=new WorldRules();
  for(let i=0;i<240;i++){r.rotate(-56+Math.sin(i)*.15);advance(r,1/60);}
  expect(r.canWalk).toBe(true);
 });
 it("all enumerated configurations use reachable, forward-facing non-decoy edges",()=>{
  const config:Configuration={...INITIAL};
  const values={axis:[-56,-22,0,18,52],stairs:[-34,-12,34],crown:[-38,8]};
  for(const node of Object.keys(ACTIVE) as NodeId[]) for(const axis of values.axis) for(const stairs of values.stairs) for(const crown of values.crown) {
   Object.assign(config,{axis,stairs,crown});
   for(const a of evaluate(config,node,camera,1440,1000).filter(a=>a.legal)) {
    const c=CONNECTIONS.find(c=>c.id===a.id)!;
    expect(c.from).toBe(node);expect(c.decoy).toBeUndefined();expect(a.continuity).toBeGreaterThan(.86);
   }
  }
 });
});

describe("toleranced hand input",()=>{
 it("seats accepted combinations so small hand offsets cannot accumulate into a dead end",()=>{
  const r=new WorldRules();
  for(const [node,angle] of solution) {
   expect(r.platform).toBe(node);
   r.rotate(angle+.5);advance(r,4);expect(r.confirm()).toBe(true);
   const controls=r.walkingConnection!.controls;
   for(const [key,value] of Object.entries(controls)) expect(r.config[key as keyof Configuration]).toBe(value);
   advance(r,8.1);
  }
  expect(r.platform).toBe("C");
 });
});
