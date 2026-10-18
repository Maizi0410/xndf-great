import * as T from "three";
import { VIEW_FROM, VIEW_TARGET, clamp } from "../game/puzzle";
import type { Phase } from "../game/rules";

export const OVERVIEW_ZOOM = .92;
export type CameraMode = "OVERVIEW" | "ALIGNMENT_FOCUS" | "CONNECTION_HOLD" | "TRAVERSAL_PULLBACK" | "RETURN_OVERVIEW";
export interface CameraCue {
  phase: Phase;
  node: string;
  proximity: number;
  legal: boolean;
  focus: T.Vector3[];
  actor: T.Vector3;
  travel: number;
  endTime: number;
}
const smooth = (t: number) => { t = clamp(t, 0, 1); return t*t*(3-2*t); };
/** One owner of the real render camera. Rotation is invariant: translating the
 * eye and target together preserves the viewing-ray nullspace of the puzzle. */
export class CinematicCamera {
  mode: CameraMode = "OVERVIEW";
  reduced = false;
  offset = new T.Vector3();
  target = VIEW_TARGET.clone();
  overviewOffset = new T.Vector3();
  private lowProximity = 0;
  private lastNode = "A";
  private pullOffset = new T.Vector3();
  private pullZoom = 1;
  private right = new T.Vector3();
  private up = new T.Vector3();
  private wasConnecting = false;
  private heldFocus: T.Vector3[] = [];
  constructor(public camera: T.OrthographicCamera) {
    camera.updateMatrixWorld(true);
    this.right.setFromMatrixColumn(camera.matrixWorld,0).normalize();
    this.up.setFromMatrixColumn(camera.matrixWorld,1).normalize();
    this.overviewOffset.copy(this.up).multiplyScalar(2.6);
  }
  reset() {
    this.mode="OVERVIEW"; this.offset.copy(this.overviewOffset); this.target.copy(VIEW_TARGET).add(this.offset);
    this.camera.position.copy(VIEW_FROM).add(this.offset); this.camera.lookAt(this.target); this.camera.zoom=OVERVIEW_ZOOM;
    this.lowProximity=0; this.lastNode="A"; this.heldFocus=[];this.wasConnecting=false;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);
  }
  /** Fit bridge ends into the area between journal, header and controls.
   * Solve the orthographic screen translation at the goal zoom, never rotate. */
  private frame(points: T.Vector3[], width: number, height: number) {
    const center=new T.Vector3(); points.forEach(p=>center.add(p)); center.multiplyScalar(1/points.length);
    center.y+=.22;
    const xs=points.map(p=>p.dot(this.right)), ys=points.map(p=>p.dot(this.up));
    const portrait=width/height<1.1;
    const rect=portrait ? {x:.5,y:.48,w:.72,h:.34} : {x:.64,y:.42,w:.53,h:.43};
    const spanX=Math.max(.7,Math.max(...xs)-Math.min(...xs));
    const spanY=Math.max(.7,Math.max(...ys)-Math.min(...ys));
    const viewWidth=this.camera.right-this.camera.left, viewHeight=this.camera.top-this.camera.bottom;
    const zoom=clamp(Math.min(OVERVIEW_ZOOM*(this.reduced?1.14:1.46),viewWidth*rect.w/spanX,viewHeight*rect.h/spanY),1,1.46);
    const x=center.clone().sub(VIEW_FROM).dot(this.right)-((this.camera.right+this.camera.left)/2+(rect.x-.5)*viewWidth/zoom);
    const y=center.clone().sub(VIEW_FROM).dot(this.up)-((this.camera.top+this.camera.bottom)/2+(.5-rect.y)*viewHeight/zoom);
    return {zoom,offset:this.right.clone().multiplyScalar(x).addScaledVector(this.up,y)};
  }
  update(rawDt: number,cue: CameraCue,width: number,height: number) {
    const dt=Number.isFinite(rawDt)?clamp(rawDt,0,.1):0;
    let next=this.mode;
    const finite=cue.focus.length>0 && cue.focus.every(p=>p.toArray().every(Number.isFinite));
    if(cue.phase==="connecting") next="CONNECTION_HOLD";
    else if(cue.phase==="walking") next="TRAVERSAL_PULLBACK";
    else if(cue.phase==="ending" || cue.phase==="complete") next="RETURN_OVERVIEW";
    else if(cue.node!==this.lastNode) {next="RETURN_OVERVIEW";this.lowProximity=0;}
    else if(finite && (cue.legal || cue.phase==="ready")) next="CONNECTION_HOLD";
    else if(finite && cue.proximity>.62) {next="ALIGNMENT_FOCUS";this.lowProximity=0;}
    else if(this.mode==="ALIGNMENT_FOCUS" || this.mode==="CONNECTION_HOLD") {
      this.lowProximity=cue.proximity<.34?this.lowProximity+dt:0;
      if(this.lowProximity>.45 || !finite) next="RETURN_OVERVIEW";
      else next="ALIGNMENT_FOCUS";
    }
    else if(this.mode==="TRAVERSAL_PULLBACK") next="RETURN_OVERVIEW";
    this.lastNode=cue.node;
    if(!finite && (next==="ALIGNMENT_FOCUS" || next==="CONNECTION_HOLD")) next="RETURN_OVERVIEW";
    if(next==="TRAVERSAL_PULLBACK" && this.mode!==next) {
      this.pullOffset.copy(this.offset);this.pullZoom=this.camera.zoom;
    }
    if(cue.phase==="connecting" && !this.wasConnecting) this.heldFocus=cue.focus.map(p=>p.clone());
    this.wasConnecting=cue.phase==="connecting";
    this.mode=next;
    let goalZoom=OVERVIEW_ZOOM, goalOffset=this.overviewOffset.clone();
    if(next==="ALIGNMENT_FOCUS" || next==="CONNECTION_HOLD") {
      const points=cue.phase==="connecting" && this.heldFocus.length?this.heldFocus:cue.focus;
      const framing=this.frame(points,width,height);goalZoom=framing.zoom;goalOffset=framing.offset;
    }
    if(next==="TRAVERSAL_PULLBACK") {
      const p=smooth(cue.travel/(this.reduced ? .17 : .29));
      goalZoom=T.MathUtils.lerp(this.pullZoom,OVERVIEW_ZOOM,p);
      const follow=cue.actor.clone().sub(VIEW_TARGET);
      // Following only in the view plane preserves all depth-separated seams.
      const plane=this.right.clone().multiplyScalar(follow.dot(this.right)).addScaledVector(this.up,follow.dot(this.up));
      goalOffset=this.pullOffset.clone().lerp(this.overviewOffset,p).addScaledVector(plane,Math.sin(Math.PI*cue.travel)*.1*p);
    }
    if(cue.phase==="ending" || cue.phase==="complete") goalZoom=OVERVIEW_ZOOM*(1-.075*smooth(cue.endTime/4));
    if(!goalOffset.toArray().every(Number.isFinite) || !Number.isFinite(goalZoom)) {goalOffset.copy(this.overviewOffset);goalZoom=OVERVIEW_ZOOM;this.mode="RETURN_OVERVIEW";}
    // Independent time constants: framing eases faster than the magnification.
    this.offset.lerp(goalOffset,1-Math.exp(-dt/(this.reduced ? .12 : .24)));
    this.camera.zoom=T.MathUtils.damp(this.camera.zoom,goalZoom,this.reduced?11:5.5,dt);
    this.target.copy(VIEW_TARGET).add(this.offset);
    this.camera.position.copy(VIEW_FROM).add(this.offset);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
    if(this.mode==="RETURN_OVERVIEW" && cue.phase!=="ending" && cue.phase!=="complete" && this.offset.distanceTo(this.overviewOffset)<.025 && Math.abs(this.camera.zoom-OVERVIEW_ZOOM)<.005) this.mode="OVERVIEW";
  }
  snapshot() {
    return {mode:this.mode,zoom:this.camera.zoom,position:this.camera.position.toArray(),target:this.target.toArray(),reduced:this.reduced};
  }
}
