import { ACTIVE, CONNECTIONS, INITIAL, OUTGOING, clamp, type Alignment, type Configuration, type Connection, type Mechanism, type NodeId } from "./puzzle";
export { clamp } from "./puzzle";
export type Phase = "idle" | "forming" | "ready" | "connecting" | "walking" | "ending" | "complete";
export class WorldRules {
  platform: NodeId = "A";
  phase: Phase = "idle";
  config: Configuration = { ...INITIAL };
  route: string | null = null;
  candidate: string | null = null;
  growth: Record<string,number> = Object.fromEntries(CONNECTIONS.map(c => [c.id,0]));
  alignments: Alignment[] = [];
  dwell = 0; travel = 0; endTime = 0; changes = 0; elapsed = 0; stageTime = 0;
  traversed: string[] = [];
  walkingConnection: Connection | null = null;
  connectionTime = 0;
  connectionDuration = 1.05;
  private connectionStart: Configuration = {...INITIAL};
  get active(): Mechanism { return ACTIVE[this.platform]; }
  get angle() { return this.config[this.active]; }
  get next() { return OUTGOING[this.platform]; }
  get locked() { return ["connecting","walking","ending","complete"].includes(this.phase); }
  get proximity() { return this.alignments.find(a => a.id === this.next?.id)?.proximity ?? 0; }
  get canWalk() {
    return this.phase === "ready" && this.route === this.next?.id && this.alignments.some(a => a.id === this.route && a.legal) && this.growth[this.route!] === 1;
  }
  rotate(angle: number) {
    if (!this.locked && Number.isFinite(angle)) {
      const next = clamp(angle,-80,80);
      if (next !== this.angle) {
        this.config[this.active] = next;
        // Invalidate synchronously, even before the next renderer measurement.
        this.route = null;
        this.alignments = [];
        this.phase = "idle";
      }
    }
  }
  snap() {
    if (this.locked) return;
    const angles = [...new Set(CONNECTIONS.map(c => c.controls[this.active]).filter((x): x is number => x !== undefined))];
    const target = angles.find(a => Math.abs(a-this.angle) <= 4);
    if (target !== undefined) this.rotate(target);
  }
  measure(alignments: Alignment[]) { if (!this.locked) this.alignments = alignments; }
  confirm() {
    if (!this.canWalk) return false;
    this.walkingConnection = this.next!;
    this.connectionStart={...this.config};
    this.phase = "connecting"; this.connectionTime=0; this.connectionDuration=1.05; this.travel = 0;
    return true;
  }
  accelerateConnection() {
    if(this.phase!=="connecting") return false;
    this.connectionDuration=Math.min(this.connectionDuration,Math.max(.32,this.connectionTime+.14));
    return true;
  }
  reset() { Object.assign(this,new WorldRules()); }
  update(rawDt: number) {
    const dt = clamp(rawDt,0,.1);
    this.elapsed += dt; this.stageTime += dt;
    if(this.phase === "connecting") {
      this.connectionTime=Math.min(this.connectionDuration,this.connectionTime+dt);
      const t=clamp(this.connectionTime/.2,0,1),e=t*t*(3-2*t);
      for(const [key,target] of Object.entries(this.walkingConnection!.controls)) {
        const k=key as Mechanism;this.config[k]=this.connectionStart[k]+(target!-this.connectionStart[k])*e;
      }
      if(this.connectionTime>=this.connectionDuration) this.phase="walking";
      return;
    }
    if (this.phase === "walking") {
      this.travel = Math.min(1,this.travel + dt/8);
      if (this.travel >= 1) {
        const connection = this.walkingConnection!;
        this.traversed.push(connection.id);
        this.platform = connection.to;
        this.stageTime = 0;
        this.phase = this.platform === "C" ? "ending" : "idle";
        this.route = null; this.candidate = null; this.dwell = 0; this.alignments = [];
      }
      return;
    }
    if (this.phase === "ending") {
      this.endTime += dt;
      if (this.endTime >= 5) this.phase = "complete";
      return;
    }
    if (this.phase === "complete") return;
    const next = this.alignments.find(a => a.legal)?.id ?? null;
    if (next !== this.candidate) { this.candidate = next; this.dwell = 0; }
    else this.dwell += dt;
    const stable = this.dwell >= .45 ? next : null;
    for (const c of CONNECTIONS) {
      if (c.id !== stable) this.growth[c.id] = Math.max(0,this.growth[c.id]-dt/.85);
    }
    const oldGone = CONNECTIONS.every(c => c.id === stable || this.growth[c.id] === 0);
    if (stable && oldGone) {
      if (this.growth[stable] === 0) this.changes++;
      this.growth[stable] = Math.min(1,this.growth[stable]+dt/1.8);
    }
    this.route = stable && this.growth[stable] === 1 ? stable : null;
    this.phase = this.route ? "ready" : stable || Object.values(this.growth).some(g => g>0) ? "forming" : "idle";
  }
}
