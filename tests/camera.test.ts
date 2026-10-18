import { describe,it,expect } from "vitest";
import * as T from "three";
import { CinematicCamera, OVERVIEW_ZOOM, type CameraCue } from "../src/scene/cinematic-camera";
import { CONNECTIONS, INITIAL, VIEW_RAY, VIEW_FROM, VIEW_TARGET, NODES, bridgePose, createPuzzleCamera, evaluate, screenPoint, travelPoint } from "../src/game/puzzle";
import { WorldRules } from "../src/game/rules";
const c=CONNECTIONS[0],config={...INITIAL,...c.controls},pose=bridgePose(c,config);
const cue:CameraCue={phase:"idle",node:"A",proximity:0,legal:false,focus:[pose.left.tip,pose.right.tip],actor:NODES.A,travel:0,endTime:0};
function step(d:CinematicCamera,input:CameraCue,seconds=1.5,w=1440,h=1000){for(let i=0;i<seconds*60;i++)d.update(1/60,input,w,h);}
describe("event-driven real orthographic camera",()=>{
 it("visibly focuses, holds confirmation, pulls back with traversal and restores overview",()=>{
  const camera=createPuzzleCamera(),d=new CinematicCamera(camera);step(d,cue);expect(camera.zoom).toBeCloseTo(OVERVIEW_ZOOM,3);expect(d.mode).toBe("OVERVIEW");
  step(d,{...cue,proximity:.8});expect(d.mode).toBe("ALIGNMENT_FOCUS");expect(camera.zoom).toBeGreaterThan(1.32);expect(camera.position.distanceTo(VIEW_FROM)).toBeGreaterThan(.1);
  step(d,{...cue,proximity:1,legal:true,phase:"connecting"},1);expect(d.mode).toBe("CONNECTION_HOLD");const focusedZoom=camera.zoom;
  for(let i=0;i<180;i++) d.update(1/60,{...cue,phase:"walking",travel:i/480,actor:travelPoint(c,pose,i/480)},1440,1000);
  expect(d.mode).toBe("TRAVERSAL_PULLBACK");expect(camera.zoom).toBeLessThan(focusedZoom-.3);
  step(d,{...cue,node:"L"},3);expect(d.mode).toBe("OVERVIEW");expect(camera.position.distanceTo(VIEW_FROM.clone().add(d.overviewOffset))).toBeLessThan(.03);
 });
 it("does not flicker at the approach boundary or cut under small hand jitter",()=>{
  const camera=createPuzzleCamera(),d=new CinematicCamera(camera);step(d,{...cue,proximity:.8});
  let last=camera.zoom;
  for(let i=0;i<240;i++){
   d.update(1/60,{...cue,proximity:i%2?.4:.64},1440,1000);expect(d.mode).toBe("ALIGNMENT_FOCUS");expect(Math.abs(camera.zoom-last)).toBeLessThan(.05);last=camera.zoom;
  }
  step(d,{...cue,proximity:0},.3);expect(d.mode).toBe("ALIGNMENT_FOCUS");step(d,cue,3);expect(d.mode).toBe("OVERVIEW");
 });
 it.each([[1440,1000],[1920,1080],[768,1024],[390,844]])("keeps the current seam away from UI at %sx%s",(w,h)=>{
  for(const c of CONNECTIONS.filter(c=>!c.decoy)){
   const pose=bridgePose(c,{...INITIAL,...c.controls}),camera=createPuzzleCamera(w/h),d=new CinematicCamera(camera);
   step(d,{...cue,node:c.from,phase:"ready",legal:true,proximity:1,focus:[pose.left.tip,pose.right.tip]},2,w,h);
   for(const point of [pose.left.tip,pose.right.tip]){
    const screen=screenPoint(point,camera,w,h);expect(screen.x/w).toBeGreaterThan(.3);expect(screen.x/w).toBeLessThan(.89);expect(screen.y/h).toBeGreaterThan(.25);expect(screen.y/h).toBeLessThan(.6);
   }
  }
 });
 it("keeps the viewing direction exactly fixed throughout every camera state",()=>{
  const camera=createPuzzleCamera(),d=new CinematicCamera(camera);
  for(let i=0;i<480;i++){
   d.update(1/60,{...cue,phase:i<120?"ready":i<180?"connecting":i<450?"walking":"ending",legal:true,proximity:1,travel:(i-180)/270,endTime:(i-450)/60},1440,1000);
   expect(camera.getWorldDirection(new T.Vector3()).dot(VIEW_RAY.clone().negate())).toBeGreaterThan(.99999999);
  }
 });
 it("uses a smaller, faster but visible close-up for reduced motion",()=>{
  const camera=createPuzzleCamera(),d=new CinematicCamera(camera);d.reduced=true;step(d,{...cue,proximity:1,legal:true,phase:"ready"},1);
  expect(camera.zoom).toBeGreaterThan(1.04);expect(camera.zoom).toBeLessThan(1.16);
  step(d,{...cue,focus:[new T.Vector3(NaN,0,0)]},3);expect(d.mode).toBe("OVERVIEW");expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
 });
 it("preserves legal and illegal results throughout pan and zoom, including tolerance boundaries",()=>{
  for(const c of CONNECTIONS) for(const zoom of [.8,1,1.14,1.46,1.6]) for(const angle of [-8,-4,0,3,8]){
   const config={...INITIAL,...c.controls};config.axis+=angle;
   const baseline=createPuzzleCamera(),camera=createPuzzleCamera();camera.zoom=zoom;
   const offset=new T.Vector3(2.7,1.4,-.9);camera.position.add(offset);camera.lookAt(VIEW_TARGET.clone().add(offset));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   const base=evaluate(config,c.from,baseline,1440,1000).map(a=>[a.id,a.legal,a.reason]);
   expect(evaluate(config,c.from,camera,1440,1000).map(a=>[a.id,a.legal,a.reason])).toEqual(base);
  }
 });
 it("orthographic reframing cannot make an actually occluded joint legal",()=>{
  const wall=new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial());
  wall.position.copy(pose.left.tip).addScaledVector(VIEW_RAY,3);wall.updateMatrixWorld(true);
  for(const zoom of [.8,.92,1.14,1.46]){
   const camera=createPuzzleCamera(),offset=new T.Vector3(-2,3,1);
   camera.position.add(offset);camera.lookAt(VIEW_TARGET.clone().add(offset));camera.zoom=zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   expect(evaluate(config,"A",camera,1440,1000,[wall]).find(a=>a.id==="AL")?.reason).toBe("occluded");
  }
 });
 it("does not interrupt any of the five crossings while the real camera moves",()=>{
  const r=new WorldRules(),camera=createPuzzleCamera(),d=new CinematicCamera(camera);
  for(const [angle,node] of [[-56,"L"],[34,"B"],[52,"U"],[-38,"B2"],[-22,"C"]] as const){
   r.rotate(angle);
   for(let i=0;i<240;i++){const con=r.next!,p=bridgePose(con,r.config);d.update(1/60,{...cue,node:r.platform,phase:r.phase,legal:r.canWalk,proximity:r.proximity,focus:[p.left.tip,p.right.tip]},1440,1000);r.measure(evaluate(r.config,r.platform,camera,1440,1000));r.update(1/60);}
   expect(r.confirm()).toBe(true);
   for(let i=0;i<560;i++){const con=r.walkingConnection!,p=bridgePose(con,r.config);d.update(1/60,{...cue,node:r.platform,phase:r.phase,legal:true,proximity:1,focus:[p.left.tip,p.right.tip],travel:r.travel,actor:travelPoint(con,p,r.travel)},1440,1000);r.update(1/60);}
   expect(r.platform).toBe(node);
  }
 });
});
